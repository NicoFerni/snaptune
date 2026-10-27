#include "AutoTuneEngine.h"

#include <algorithm>
#include <cmath>

namespace snaptune
{
namespace
{
    constexpr double lowestDetectableHz = 65.0;
    constexpr int trackCapacity = 512; // power of two
    constexpr int markCapacity = 4096; // power of two
    constexpr int windowTableSize = 2048;
    constexpr float maxFormantSemitones = 5.0f;

    // Per-hop limits of the pitch tracking (a hop is 2.7 ms at every sample rate).
    constexpr int maxBridgedHops = 15;   // continuity carries a voice through ~40 ms of poor periodicity at most
    constexpr int maxGuardedHops = 12;   // the octave guard overrides the detector for ~32 ms at most
    constexpr int maxHeldHops = 15;      // a dropout this short keeps the note's target and correction
    constexpr int steadyHopsNeeded = 8;  // ~21 ms of steps under half a semitone make a steady stretch
    constexpr int recentPeriodHops = 24; // ~64 ms of track the Live splices judge the delay by
    constexpr int rawChoiceWinHops = 3;  // Live: the unsmoothed note choice wins after ~8 ms

    // Studio grain offsets (see emitGrain).
    constexpr double quietLevel = 1.0e-4; // power 40 dB under the voice: moving the grid there can't be heard
    constexpr double voiceRelease = 0.3;  // seconds for the held voice level to fall by 1/e
    constexpr double maxRealign = 0.08;   // most a quiet grain moves the grid, as a fraction of the period
    constexpr double unwindRate = 0.02;   // offset unwound per unvoiced grain, as a fraction of their spacing

    struct VoiceRange
    {
        float lowHz, highHz;
    };

    constexpr VoiceRange voiceRanges[] = {
        { 110.0f, 1400.0f }, // soprano
        { 75.0f, 1000.0f },  // alto / tenor
        { 65.0f, 600.0f },   // low male
        { 65.0f, 1600.0f },  // instrument
    };

    int nextPowerOfTwo (int x)
    {
        int p = 1;

        while (p < x)
            p <<= 1;

        return p;
    }

    // 4-point, 3rd-order Hermite interpolation.
    inline float readInterpolated (const float* ring, int mask, double position) noexcept
    {
        const auto index = (int64_t) std::floor (position);
        const auto frac = (float) (position - (double) index);
        const float xm1 = ring[(index - 1) & mask];
        const float x0 = ring[index & mask];
        const float x1 = ring[(index + 1) & mask];
        const float x2 = ring[(index + 2) & mask];
        const float c = (x1 - xm1) * 0.5f;
        const float v = x0 - x1;
        const float w = c + v;
        const float a = w + v + (x2 - x0) * 0.5f;
        const float b = w + a;
        return ((a * frac - b) * frac + c) * frac + x0;
    }

    // Independent partial sums let the compiler keep the multiply-adds in vector registers.
    inline float dotProduct (const float* a, const float* b, int n) noexcept
    {
        float sums[8] = {};
        int i = 0;

        for (; i + 8 <= n; i += 8)
            for (int j = 0; j < 8; ++j)
                sums[j] += a[i + j] * b[i + j];

        for (; i < n; ++i)
            sums[0] += a[i] * b[i];

        return ((sums[0] + sums[1]) + (sums[2] + sums[3])) + ((sums[4] + sums[5]) + (sums[6] + sums[7]));
    }
} // namespace

AutoTuneEngine::AutoTuneEngine()
{
    windowTable.resize (windowTableSize + 2);

    for (size_t i = 0; i < windowTable.size(); ++i)
    {
        const double x = std::min (1.0, (double) i / windowTableSize);
        windowTable[i] = (float) (0.5 * (1.0 + std::cos (juce::MathConstants<double>::pi * x)));
    }

    track.resize (trackCapacity);
    marks.resize (markCapacity);
    markMask = markCapacity - 1;
}

void AutoTuneEngine::prepare (double newSampleRate, int newMaxChannels)
{
    sampleRate = newSampleRate;
    maxChannels = juce::jlimit (1, 2, newMaxChannels);
    activeChannels = maxChannels;

    maxPeriod = (int) std::ceil (sampleRate / lowestDetectableHz);
    hopSize = std::max (32, (int) std::lround (sampleRate / 375.0));
    unvoicedPeriod = (int) std::lround (sampleRate / 200.0);
    studioLatency = 3 * maxPeriod;
    scheduleAhead = (int) std::ceil (1.4 * maxPeriod);

    // Live mode reads between a few samples and about one period behind the input; report the
    // middle of that range for a typical (200 Hz) voice.
    liveMinDelay = std::max (8.0, std::round (sampleRate * 0.0002));
    liveLatency = (int) liveMinDelay + (int) std::lround (sampleRate / 400.0);
    longPeakDecay = (float) std::exp (-1.0 / sampleRate);
    switchFadeLength = std::max (1, (int) std::lround (sampleRate * 0.01));

    activeMode = settings.mode;
    latency = activeMode == LatencyMode::live ? liveLatency : studioLatency;

    detector.prepare (maxPeriod, maxPeriod + 2);
    frame.assign ((size_t) detector.getFrameSize(), 0.0f);

    ringSize = nextPowerOfTwo (studioLatency + 4 * maxPeriod + detector.getFrameSize() + 1024);
    ringMask = ringSize - 1;

    for (auto& ring : inputRing)
        ring.assign ((size_t) ringSize, 0.0f);

    for (auto& ring : outputRing)
        ring.assign ((size_t) ringSize, 0.0f);

    detectionRing.assign ((size_t) ringSize, 0.0f);
    peakRing.assign ((size_t) ringSize, 0.0f);

    // A cycle match spans the lag search (up to ~1.2 periods) plus one period of window.
    cycleScratch.assign ((size_t) (3 * maxPeriod + 8), 0.0f);
    cycleEnergy.assign (cycleScratch.size() + 1, 0.0);

    hpCoeff = (float) std::exp (-juce::MathConstants<double>::twoPi * 50.0 / sampleRate);
    lpCoeff = (float) std::exp (-juce::MathConstants<double>::twoPi * 1500.0 / sampleRate);

    mixSmoothed.reset (sampleRate, 0.03);
    mixSmoothed.setCurrentAndTargetValue (settings.mix);

    reset();
}

void AutoTuneEngine::reset()
{
    for (auto& ring : inputRing)
        std::fill (ring.begin(), ring.end(), 0.0f);

    for (auto& ring : outputRing)
        std::fill (ring.begin(), ring.end(), 0.0f);

    std::fill (detectionRing.begin(), detectionRing.end(), 0.0f);
    std::fill (peakRing.begin(), peakRing.end(), 0.0f);
    writePos = 0;

    hpLastIn = hpLastOut = lpState = 0.0f;
    recentCount = 0;
    jumpPending = false;
    steadyHops = 0;
    guardedHops = 0;
    bridgedHops = 0;
    anchorPeriod = 0.0f;
    typicalAperiodicity = 0.0f;

    wasVoiced = false;
    currentTarget = -1;
    correction = 0.0f;
    noteAge = 0.0f;
    choiceNote = 0.0f;
    lastInputNote = 0.0f;
    rawChoiceHops = 0;
    unvoicedHops = maxHeldHops + 1;
    correctionStep = 0.0f;
    hasCorrectionStep = false;
    stepPower = stepNoise = 0.0f;
    trackCount = 0;
    lastTrackTime = -1.0e12;
    stampPeriod = 0.5f * (float) maxPeriod;

    markCount = 0;
    markPolarity = 1.0f;
    checkedMark = -1;
    longerSince = -1.0;

    synthesisTime = 0.0;
    lastCentre = lastSource = -unvoicedPeriod;
    lastStep = unvoicedPeriod;
    lastSourceMark = -1;
    lastGrainVoiced = false;
    voiceLevel = 0.0;

    // The next sample written lands at index writePos; read `latency` samples behind it.
    liveTap = (double) (writePos - liveLatency);
    fadeLength = fadePosition = 0;
    liveCorrectionFrom = liveCorrectionTo = 0.0;
    liveRamp = hopSize;
    longPeak = 0.0f;
    quietRun = 0;
    switchFadePosition = switchFadeLength;
}

void AutoTuneEngine::switchMode (LatencyMode mode)
{
    activeMode = mode;
    latency = mode == LatencyMode::live ? liveLatency : studioLatency;

    // Restart whichever renderer is taking over from the current position.
    for (auto& ring : outputRing)
        std::fill (ring.begin(), ring.end(), 0.0f);

    // Called before the next sample (index writePos) is written.
    const auto now = (double) (writePos - latency);
    markCount = 0;
    checkedMark = -1;
    longerSince = -1.0;
    synthesisTime = now;
    lastCentre = lastSource = now - unvoicedPeriod;
    lastStep = unvoicedPeriod;
    lastSourceMark = -1;
    lastGrainVoiced = false;
    voiceLevel = 0.0;

    liveTap = now;
    fadeLength = fadePosition = 0;
    longPeak = 0.0f;
    quietRun = 0;

    // Fade the output back in so the jump in delay doesn't click.
    switchFadePosition = 0;
}

//==============================================================================
void AutoTuneEngine::noteOn (int note) noexcept
{
    if (note >= 0 && note < 128)
    {
        ++heldNotes[(size_t) note];
        updateHeldMask();
    }
}

void AutoTuneEngine::noteOff (int note) noexcept
{
    if (note >= 0 && note < 128 && heldNotes[(size_t) note] > 0)
    {
        --heldNotes[(size_t) note];
        updateHeldMask();
    }
}

void AutoTuneEngine::allNotesOff() noexcept
{
    heldNotes.fill (0);
    updateHeldMask();
}

void AutoTuneEngine::updateHeldMask() noexcept
{
    uint16_t mask = 0;

    for (int note = 0; note < 128; ++note)
        if (heldNotes[(size_t) note] > 0)
            mask = (uint16_t) (mask | (1u << pitchClass (note)));

    heldMask = mask;
    heldMaskForUi.store (mask, std::memory_order_relaxed);
}

//==============================================================================
void AutoTuneEngine::process (float* const* channels, int numChannels, int startSample, int numSamples, bool bypassed)
{
    if (ringSize == 0)
        return; // not prepared yet: leave the audio untouched

    if (settings.mode != activeMode)
        switchMode (settings.mode);

    activeChannels = juce::jlimit (1, maxChannels, numChannels);
    formantStretch = activeMode == LatencyMode::live ? 1.0 : std::exp2 (juce::jlimit (-maxFormantSemitones, maxFormantSemitones, settings.formantSemitones) / 12.0);
    mixSmoothed.setTargetValue (bypassed ? 0.0f : juce::jlimit (0.0f, 1.0f, settings.mix));

    const float monoScale = 1.0f / (float) activeChannels;

    for (int i = startSample; i < startSample + numSamples; ++i)
    {
        const auto slot = (size_t) (writePos & ringMask);
        float mono = 0.0f;

        for (int c = 0; c < activeChannels; ++c)
        {
            const float x = channels[c][i];
            inputRing[(size_t) c][slot] = x;
            mono += x;
        }

        mono *= monoScale;

        const float highPassed = hpCoeff * (hpLastOut + mono - hpLastIn);
        hpLastIn = mono;
        hpLastOut = highPassed;
        lpState = highPassed + lpCoeff * (lpState - highPassed);

        detectionRing[slot] = highPassed;
        peakRing[slot] = lpState;
        ++writePos;

        if (writePos % hopSize == 0 && writePos >= detector.getFrameSize())
            analyseHop();

        float wet[2] = { 0.0f, 0.0f };

        if (activeMode == LatencyMode::live)
            liveSample (wet);
        else
            studioSample (wet);

        // The dry signal is delayed by the reported latency so Mix stays aligned with the host.
        const int64_t dryIndex = writePos - 1 - latency;
        const float mix = mixSmoothed.getNextValue();
        float gain = 1.0f;

        if (switchFadePosition < switchFadeLength)
            gain = (float) ++switchFadePosition / (float) switchFadeLength;

        for (int c = 0; c < activeChannels; ++c)
        {
            const float dry = dryIndex >= 0 ? inputRing[(size_t) c][(size_t) (dryIndex & ringMask)] : 0.0f;
            channels[c][i] = gain * (dry + mix * (wet[c] - dry));
        }
    }
}

void AutoTuneEngine::studioSample (float* wet)
{
    // The output sample corresponds to the input `latency` samples ago.
    const int64_t now = writePos - 1 - latency;

    // Place marks only as far ahead as synthesis needs them: the further a mark is from the
    // newest pitch estimate, the more its voicing decision is a guess.
    const double recentPeriod = markCount > 0 && markAt (markCount - 1).voiced ? (double) markAt (markCount - 1).period : 0.0;
    const auto markHorizon = std::min<int64_t> (writePos - 2, now + scheduleAhead + hopSize
                                                                  + (int64_t) (3.0 * std::max (recentPeriod, (double) unvoicedPeriod)));
    generateMarks (markHorizon);

    if (now < 0)
        return;

    while (synthesisTime - (double) now <= (double) scheduleAhead)
        emitGrain (now);

    const auto outSlot = (size_t) (now & ringMask);

    for (int c = 0; c < activeChannels; ++c)
    {
        wet[c] = outputRing[(size_t) c][outSlot];
        outputRing[(size_t) c][outSlot] = 0.0f;
    }
}

//==============================================================================
float AutoTuneEngine::readInput (int channel, double position) const noexcept
{
    return readInterpolated (inputRing[(size_t) channel].data(), ringMask, position);
}

void AutoTuneEngine::liveSample (float* wet)
{
    // The correction ramps across each hop so the ratio changes smoothly, not in steps.
    liveRamp = std::min (liveRamp + 1, hopSize);
    const double correctionNow = liveCorrectionFrom + (liveCorrectionTo - liveCorrectionFrom) * (double) liveRamp / hopSize;
    const double ratio = juce::jlimit (0.5, 2.0, std::exp2 (correctionNow / 12.0));

    // Near silence: 50 dB below the loudest of the last second (or about -80 dBFS).
    const float level = std::abs (detectionRing[(size_t) ((writePos - 1) & ringMask)]);
    longPeak = std::max (level, longPeak * longPeakDecay);
    quietRun = level < std::max (1.0e-4f, 0.003f * longPeak) ? std::min (quietRun + 1, ringSize) : 0;

    if (fadeLength == 0)
        maybeSplice (ratio);

    if (fadeLength > 0)
    {
        const double t = ((double) fadePosition + 0.5) / fadeLength;
        const double fadeIn = fadeEqualPower ? std::sin (0.5 * juce::MathConstants<double>::pi * t)
                                             : 0.5 - 0.5 * std::cos (juce::MathConstants<double>::pi * t);
        const double fadeOut = fadeEqualPower ? std::cos (0.5 * juce::MathConstants<double>::pi * t) : 1.0 - fadeIn;

        for (int c = 0; c < activeChannels; ++c)
            wet[c] = (float) (fadeOut * readInput (c, liveTap) + fadeIn * readInput (c, spliceTap));

        spliceTap += ratio;

        if (++fadePosition >= fadeLength)
        {
            liveTap = spliceTap;
            fadeLength = fadePosition = 0;
        }
        else
        {
            // The splice was timed with the ratio at its start; if the ratio rises during the fade
            // (the hop's glide onto a larger correction), the fading copy mustn't read past the input.
            liveTap = std::min (liveTap + ratio, (double) (writePos - 2));
        }

        return;
    }

    for (int c = 0; c < activeChannels; ++c)
        wet[c] = readInput (c, liveTap);

    liveTap += ratio;
}

void AutoTuneEngine::maybeSplice (double ratio)
{
    const auto newest = (double) (writePos - 1);
    const double delay = newest - liveTap;
    const auto& latest = track[(size_t) ((trackCount - 1) & (trackCapacity - 1))];
    const bool voiced = trackCount > 0 && latest.voiced && latest.period > 1.0f;
    const bool inRange = delay < liveMinDelay + 1.5 * maxPeriod;

    if (voiced && inRange)
    {
        // Reading faster than the input arrives (pitch up) eventually catches up with the newest
        // sample: jump back one cycle and repeat it. Reading slower (pitch down) falls behind: jump
        // forward one cycle and skip it. Jumping by exactly one period of a periodic signal is
        // seamless; the cross-correlation search finds that period at the read point.
        const double period = latest.period;
        double fade = juce::jlimit (16.0, 0.006 * sampleRate, 0.5 * period);

        if (std::abs (ratio - 1.0) > 1.0e-9)
            fade = std::min (fade, 0.9 * period / std::abs (ratio - 1.0));

        // The detector can lock onto a harmonic (a third or a quarter of the period) for a few
        // hops. Measured against that, the delay looks several periods too long and gets cut by a
        // burst of short splices that don't line up with the real cycle. Judge the delay and search
        // with the longest period of the last 24 hops (~64 ms) instead.
        auto longestRecentPeriod = [this, period]
        {
            double longest = period;

            for (auto i = std::max<int64_t> (0, trackCount - recentPeriodHops); i < trackCount; ++i)
            {
                const auto& entry = track[(size_t) (i & (trackCapacity - 1))];

                if (entry.voiced)
                    longest = std::max (longest, (double) entry.period);
            }

            return longest;
        };

        if (ratio > 1.0 && delay < liveMinDelay + (ratio - 1.0) * fade + 2.0)
        {
            const double longest = longestRecentPeriod();
            startSplice (-findSpliceLength (liveTap, -1, 0.8 * period, 1.25 * longest, longest), fade, false);
        }
        else if (ratio < 1.0 && delay > liveMinDelay + 1.25 * period + 2.0)
        {
            const double longest = longestRecentPeriod();

            if (delay > liveMinDelay + 1.25 * longest + 2.0)
                startSplice (findSpliceLength (liveTap, 1, 0.8 * period, std::min (1.25 * longest, delay - liveMinDelay - 2.0), longest), fade, false);
        }

        return;
    }

    // No pitch to stay in phase with: drift back to the reported latency so Mix and the host's
    // delay compensation stay aligned (at once if the delay has left the range splicing keeps it
    // in). Unpitched audio is uncorrelated, hence equal-power. The fade is no longer than the delay
    // (16 samples at least), so it only mixes audio that has already arrived: a note starting right
    // after it isn't played twice.
    const double offset = delay - liveLatency;

    if (std::abs (offset) > 0.5 && (! inRange || driftBackInaudible (delay)))
        startSplice (offset, std::max (16.0, std::min (delay, (double) liveLatency)), true);
}

bool AutoTuneEngine::driftBackInaudible (double delay) const
{
    // The two copies are not a whole number of periods apart, so on a pitched sound the crossfade
    // is a short, comb-filtered bop. That can't be heard if everything it will mix, from the older
    // read point up to the newest sample, is near silence...
    if ((double) quietRun > std::max (delay, (double) liveLatency) + 2.0)
        return true;

    // ... or in noise. The track also reads unvoiced for a few ms as one note gives way to the
    // next, and in dropouts of up to ~20 ms inside a note, so wait that long, and still not while
    // the level is rising (a note starting) or the audio repeats at the last period (a longer
    // dropout). Checked once per hop.
    if (writePos % hopSize != 0 || std::abs (delay - liveLatency) <= 0.25 * unvoicedPeriod)
        return false;

    const auto hops = (int64_t) std::ceil (0.02 * sampleRate / hopSize);

    for (auto i = std::max<int64_t> (0, trackCount - hops); i < trackCount; ++i)
        if (track[(size_t) (i & (trackCapacity - 1))].voiced)
            return false;

    const auto window = (int) std::lround (0.01 * sampleRate);
    double recent = 0.0, before = 0.0;

    for (int i = 0; i < window; ++i)
    {
        const float a = detectionRing[(size_t) ((writePos - 1 - i) & ringMask)];
        const float b = detectionRing[(size_t) ((writePos - 1 - window - i) & ringMask)];
        recent += (double) a * a;
        before += (double) b * b;
    }

    return recent <= 2.0 * before && periodicity (stampPeriod) < 0.6;
}

double AutoTuneEngine::periodicity (double period) const
{
    // Best normalised correlation of the newest audio with itself one period (+-10 %) earlier.
    const auto newest = writePos - 1;
    const int window = juce::jlimit (64, 256, (int) std::lround (std::max (period, 0.005 * sampleRate)));
    double best = -1.0;

    for (auto lag = (int) std::floor (0.9 * period); lag <= (int) std::ceil (1.1 * period); lag += 2)
    {
        double cross = 0.0, energyA = 0.0, energyB = 0.0;

        for (int i = 0; i < window; ++i)
        {
            const float a = detectionRing[(size_t) ((newest - i) & ringMask)];
            const float b = detectionRing[(size_t) ((newest - lag - i) & ringMask)];
            cross += (double) a * b;
            energyA += (double) a * a;
            energyB += (double) b * b;
        }

        best = std::max (best, cross / std::sqrt (energyA * energyB + 1.0e-20));
    }

    return best;
}

double AutoTuneEngine::findSpliceLength (double tap, int direction, double minLength, double maxLength, double period) const
{
    // Compare the cycle just behind the read point with the one `length` samples further back
    // (direction -1) or ahead (+1), and keep the length where they line up best.
    const int window = juce::jlimit (32, 512, (int) std::lround (period));
    const auto base = (int64_t) std::floor (tap);
    const auto lo = (int) std::ceil (minLength);
    const auto hi = (int) std::floor (maxLength);

    if (hi <= lo)
        return 0.5 * (minLength + maxLength);

    double reference = 0.0;

    for (int i = 0; i < window; ++i)
    {
        const float a = detectionRing[(size_t) ((base - i) & ringMask)];
        reference += (double) a * a;
    }

    auto similarity = [&] (int length)
    {
        double cross = 0.0, energy = 0.0;
        const int64_t other = base + direction * length;

        for (int i = 0; i < window; ++i)
        {
            const float a = detectionRing[(size_t) ((base - i) & ringMask)];
            const float b = detectionRing[(size_t) ((other - i) & ringMask)];
            cross += (double) a * b;
            energy += (double) b * b;
        }

        return cross / std::sqrt (reference * energy + 1.0e-20);
    };

    int best = lo;
    double bestScore = -2.0;

    auto consider = [&] (int length)
    {
        const double score = similarity (length);

        if (score > bestScore)
        {
            bestScore = score;
            best = length;
        }
    };

    // After a leap up the search spans from 0.8 of the current period to 1.25 of the longest recent
    // one (over a thousand lengths at 96 kHz), all within one sample: a coarse pass at ~24 kHz, then
    // every length around the winner.
    const int stride = std::max (1, (int) std::lround (sampleRate / 24000.0));

    for (int length = lo; length <= hi; length += stride)
        consider (length);

    const int coarse = best;

    for (int length = std::max (lo, coarse - stride + 1); length <= std::min (hi, coarse + stride - 1); ++length)
        if (length != coarse)
            consider (length);

    // Sub-sample refinement.
    if (best > lo && best < hi)
    {
        const double a = similarity (best - 1), b = bestScore, c = similarity (best + 1);
        const double curvature = a - 2.0 * b + c;

        if (curvature < 0.0)
            return best + juce::jlimit (-0.5, 0.5, 0.5 * (a - c) / curvature);
    }

    return best;
}

void AutoTuneEngine::startSplice (double offset, double fadeSamples, bool uncorrelated)
{
    spliceTap = liveTap + offset;
    fadeLength = std::max (1, (int) std::lround (fadeSamples));
    fadePosition = 0;
    fadeEqualPower = uncorrelated;
}

//==============================================================================
void AutoTuneEngine::analyseHop()
{
    const int frameSize = detector.getFrameSize();
    const int64_t first = writePos - frameSize;

    for (int i = 0; i < frameSize; ++i)
        frame[(size_t) i] = detectionRing[(size_t) ((first + i) & ringMask)];

    const auto range = voiceRanges[juce::jlimit (0, (int) VoiceType::numTypes - 1, (int) settings.voice)];
    const auto minPeriod = (float) (sampleRate / range.highHz);
    const auto maxPeriodForVoice = std::min ((float) maxPeriod, (float) (sampleRate / range.lowHz));

    const float tracking = juce::jlimit (0.0f, 1.0f, settings.tracking);
    const float voicedThreshold = 0.14f + 0.36f * tracking;
    const float pickThreshold = std::min (0.15f, voicedThreshold);

    // Live mode has no look-ahead to hide the detector's delay behind, so it integrates over
    // ~1.5 periods of the current voice instead of the full window: the estimate then describes
    // audio about 5 ms old instead of ~10 ms. A breathy or noisy voice gets up to 2.5 periods: over
    // 1.5 its estimate scatters by ~10 cents, which hard tune passes straight to the output.
    // Between notes it is sized for half the voice's longest period (an octave above its lowest
    // note), or through a short dropout for the note if that is lower: a window shorter than a low
    // voice's period can't find it again.
    const bool live = activeMode == LatencyMode::live;
    int window = maxPeriod;

    if (live)
    {
        const double reference = wasVoiced ? (double) stampPeriod
                                           : std::max (0.5 * maxPeriodForVoice, unvoicedHops <= maxHeldHops ? (double) stampPeriod : 0.0);
        window = (int) juce::jlimit (0.35 * maxPeriod, (double) maxPeriod, (1.5 + breathiness()) * reference);
    }

    const float tracked = bridgedHops > 0 ? anchorPeriod : stampPeriod;
    const auto result = detector.analyse (frame.data(), minPeriod, maxPeriodForVoice, pickThreshold, window, wasVoiced ? tracked : 0.0f);

    // Hysteresis on both the level gate and the periodicity threshold keeps the voicing
    // decision from chattering at the ends of notes.
    // The level gate only has to ignore near-silence (-76 dBFS); the periodicity test is what
    // rejects noise. A higher gate cuts quiet mic signals into fragments.
    const float gate = wasVoiced ? 0.0001f : 0.00016f;
    const float aperiodicityLimit = wasVoiced ? voicedThreshold + 0.1f : voicedThreshold;
    bool voiced = result.period > 0.0f && result.rms > gate && result.aperiodicity < aperiodicityLimit;
    float period = result.period;
    float periodAperiodicity = result.aperiodicity;
    bool bridged = false;

    // Pitch continuity: during a note, a frame that still has a dip at the period being tracked is
    // the voice even if breath, room sound or jitter push it a little over the limit or move the pick
    // to another dip. Without this, real (and especially low, roomy) voices drop out for 15-35 ms at
    // a time. The dip is looked for around the last period that passed on its own, and for ~40 ms at
    // most, so a stretch of noise can't walk the period off somewhere else.
    if (! voiced && wasVoiced && bridgedHops < maxBridgedHops && result.rms > gate && result.trackedPeriod > 0.0f
        && result.trackedAperiodicity < aperiodicityLimit + 0.2f)
    {
        voiced = true;
        bridged = true;
        period = result.trackedPeriod;
        periodAperiodicity = result.trackedAperiodicity;
    }

    bridgedHops = bridged ? bridgedHops + 1 : 0;

    // Octave jumps within a note have to beat the tracked period. A periodic signal is also periodic
    // at every multiple of its period, so breath, room sound or other sources favour twice the
    // period or more, while a strong second harmonic (some vowels, the first formant of a low voice)
    // dips at half the period or less; either way the note would read an octave or more off for a
    // few hops, flipping the target and breaking the pitch marks and splices. Bleed from another
    // note can also take the pick to that note's period. The tracked period wins against a longer
    // pick while it still dips nearly as well (within 0.2, or 0.4 in a steady stretch where breath
    // makes it look a lot worse, which shows as a pick that isn't clean either), and against a
    // shorter one only in a steady stretch and only while it dips clearly deeper (by 0.05). Those
    // errors last a few hops; anything still held after ~32 ms is let through.
    bool jumpHeld = false;

    if (voiced && wasVoiced && result.trackedPeriod > 0.0f)
    {
        const float atTracked = result.trackedAperiodicity, picked = result.aperiodicity;
        const bool steady = steadyHops >= steadyHopsNeeded;
        const bool up = steady && period < tracked / 1.5f && atTracked < std::min (0.4f, picked - 0.05f);
        const float margin = steady && picked > 0.06f ? 0.4f : 0.2f;
        const bool down = period > 1.5f * tracked && atTracked < std::min (aperiodicityLimit + 0.2f, picked + margin);
        jumpHeld = up || down;

        // Counted for as long as the jump lasts, so once let through it stays let through (the
        // median or the jump hold below would otherwise drop the one hop it was let through for).
        if (jumpHeld && guardedHops < maxGuardedHops)
        {
            period = result.trackedPeriod;
            periodAperiodicity = atTracked;
        }
    }

    guardedHops = jumpHeld ? guardedHops + 1 : 0;

    estimateDelay = 0.5 * window;

    if (voiced && live)
    {
        // A median would cost a hop of delay. Instead hold any sudden jump of more than ~4
        // semitones for one hop, and accept it only if the next estimate confirms it.
        const bool jump = recentCount > 0 && std::abs (std::log2 (period / recentPeriods[2])) > 0.33f;

        if (jump && ! jumpPending)
        {
            jumpPending = true;
            period = recentPeriods[2];
        }
        else
        {
            jumpPending = false;
        }

        recentPeriods.fill (period);
        recentCount = 1;
    }
    else if (voiced)
    {
        // A 3-point median removes isolated octave errors; it delays the estimate by one hop.
        estimateDelay += hopSize;
        recentPeriods[0] = recentPeriods[1];
        recentPeriods[1] = recentPeriods[2];
        recentPeriods[2] = period;
        recentCount = std::min (recentCount + 1, 3);

        if (recentCount == 3)
        {
            const float a = recentPeriods[0], b = recentPeriods[1], c = recentPeriods[2];
            period = std::max (std::min (a, b), std::min (std::max (a, b), c));
        }
    }
    else
    {
        recentCount = 0;
        jumpPending = false;
        estimateDelay += live ? 0 : hopSize;
    }

    steadyHops = voiced && wasVoiced && std::abs (std::log2 (period / stampPeriod)) < 1.0f / 24.0f ? steadyHops + 1 : 0;

    // How breathy the voice is shows only where the pitch holds still: attacks, glides, trills and
    // bridged dropouts read aperiodic on any voice. So learn it at least 10 hops into a note, on a
    // period within 10 cents of the one 8 hops before.
    bool settled = voiced && ! bridged && steadyHops >= steadyHopsNeeded && trackCount >= 9;

    for (int64_t back = 1; settled && back <= 9; ++back)
        settled = track[(size_t) ((trackCount - back) & (trackCapacity - 1))].voiced;

    if (settled && std::abs (std::log2 (period / track[(size_t) ((trackCount - 8) & (trackCapacity - 1))].period)) < 10.0f / 1200.0f)
        typicalAperiodicity += 0.1f * (std::min (1.0f, periodAperiodicity) - typicalAperiodicity);

    if (voiced && ! bridged)
        anchorPeriod = period;

    updateCorrection (voiced, period);
}

void AutoTuneEngine::updateCorrection (bool voiced, float period)
{
    const auto hopSeconds = (float) (hopSize / sampleRate);
    const int previousTarget = currentTarget;
    const bool continuingNote = voiced && wasVoiced;
    PitchFrame uiFrame;

    if (voiced)
    {
        const auto inputNote = (float) (69.0 + 12.0 * std::log2 (sampleRate / period / settings.referenceHz));

        uint16_t mask = pitchClassMask (settings.key, settings.scale, settings.customMask);

        if (settings.midiTargets && heldMask != 0)
            mask = heldMask;

        // Live's estimate of a breathy voice is noisier than Studio's (short window, no median), and on
        // a note sung near the midpoint between two allowed notes each outlier would flip the target
        // for a hop or two: a semitone blip at hard tune. Choose the note from a smoothed pitch then; a
        // note the raw pitch has chosen three hops running wins anyway, which bounds the lag at ~8 ms.
        // The correction itself still follows every estimate.
        if (! wasVoiced || std::abs (inputNote - choiceNote) > 6.0f)
            choiceNote = inputNote;
        else
            choiceNote += (1.0f - 0.5f * breathiness()) * (inputNote - choiceNote);

        int target = chooseTargetNote (inputNote, mask, currentTarget, 0.12f);

        if (activeMode == LatencyMode::live)
        {
            rawChoiceHops = wasVoiced && target != currentTarget ? rawChoiceHops + 1 : 0;

            if (rawChoiceHops < rawChoiceWinHops)
                target = chooseTargetNote (choiceNote, mask, currentTarget, 0.12f);
        }

        // After a short dropout the note carries on where it was if it comes back on the same target
        // and pitch (currentTarget is -1 after a longer gap); anything else, such as the same note
        // sung again with other intonation, starts a new note.
        const bool newNote = ! wasVoiced && (target != currentTarget || target < 0 || std::abs (inputNote - lastInputNote) > 0.15f);
        lastInputNote = inputNote;

        if (newNote || target != currentTarget)
            noteAge = 0.0f;
        else
            noteAge += hopSeconds;

        // Notes start uncorrected and glide onto the target at the retune speed.
        if (newNote)
            correction = 0.0f;

        currentTarget = target;

        const float wanted = target >= 0 ? ((float) target - inputNote) * juce::jlimit (0.0f, 1.0f, settings.amount) : 0.0f;

        // Humanize: once a note has been held for a moment, slow the retune down so the
        // singer's own drift and vibrato on long notes come through.
        float retuneMs = std::max (0.0f, settings.retuneMs);
        const float sustain = juce::jlimit (0.0f, 1.0f, (noteAge - 0.12f) / 0.3f);
        retuneMs += juce::jlimit (0.0f, 1.0f, settings.humanize) * 300.0f * sustain;

        // One-pole smoothing; the time constant is a third of the retune time so the
        // correction is ~95% complete after `retuneMs`.
        const float alpha = retuneMs < 0.5f ? 1.0f : 1.0f - std::exp (-hopSeconds * 3000.0f / retuneMs);
        correction += alpha * (wanted - correction);

        uiFrame.inputNote = inputNote;
        uiFrame.outputNote = inputNote + correction;
        uiFrame.targetNote = target;
        uiFrame.voiced = true;
        unvoicedHops = 0;
    }
    else
    {
        // A dropout inside a note (breath or a consonant within it, or the detector losing a rough
        // voice for a moment) keeps the note's target and correction for up to ~40 ms. Snapping the
        // correction to zero would make the note glide onto its target again at the retune speed
        // when it comes back, and leave the voiced grains either side of the dropout (or at the end
        // of a note) only part of their correction.
        unvoicedHops = std::min (unvoicedHops + 1, maxHeldHops + 1);

        if (unvoicedHops > maxHeldHops)
        {
            correction = 0.0f;
            currentTarget = -1;
            noteAge = 0.0f;
        }
    }

    wasVoiced = voiced;

    // YIN compares the newest W samples with audio one period older, so its estimate describes the
    // point (W + period) / 2 back from the newest sample (plus a hop when the median filter is on).
    if (voiced)
        stampPeriod = period;

    auto& entry = track[(size_t) (trackCount & (trackCapacity - 1))];
    entry.time = std::max (lastTrackTime + 1.0, (double) writePos - estimateDelay - 0.5 * (double) stampPeriod);
    lastTrackTime = entry.time;
    entry.period = voiced ? period : 0.0f;
    entry.correction = correction;
    entry.voiced = voiced;
    ++trackCount;

    // Live mode reads just a few ms behind the input, but this estimate describes audio ~10 ms
    // older. Within a note, extrapolate the correction along its current slope to the read point
    // (as it will be at the end of the next hop), so fast vibrato is corrected on time. Clamped,
    // and skipped across note changes where the correction jumps.
    // While unpitched, Live reads at the input's speed: an unvoiced moment may be the next note
    // starting, and the held correction is only for the note resuming.
    double liveTarget = voiced ? correction : 0.0;
    bool stepped = false;

    if (continuingNote && currentTarget == previousTarget && trackCount >= 2)
    {
        const auto& previous = track[(size_t) ((trackCount - 2) & (trackCapacity - 1))];
        const double span = entry.time - previous.time;

        if (previous.voiced && span > 0.0)
        {
            // On a breathy voice the step between two estimates is mostly noise, and extrapolating it
            // multiplies the output's pitch jitter. Scale the slope by the share of the step that is
            // signal. The noise shows in how much the step changes from hop to hop (a vibrato barely
            // bends within a hop): for independent estimates that change has 3x the step's noise
            // variance, about 2x here as consecutive windows overlap.
            const float step = entry.correction - previous.correction;

            if (hasCorrectionStep)
            {
                const float bend = step - correctionStep;
                stepPower += 0.1f * (step * step - stepPower);
                stepNoise += 0.1f * (0.5f * bend * bend - stepNoise);
            }

            correctionStep = step;
            stepped = true;

            const double signal = stepPower > 1.0e-12f ? juce::jlimit (0.0, 1.0, 1.0 - (double) (stepNoise / stepPower)) : 1.0;
            const double ahead = liveTap + hopSize - entry.time;
            liveTarget += juce::jlimit (-0.3, 0.3, signal * step / span * ahead);
        }
    }

    hasCorrectionStep = stepped;

    // Glide from the correction in use now to the new one over the next hop.
    liveCorrectionFrom += (liveCorrectionTo - liveCorrectionFrom) * (double) liveRamp / hopSize;
    liveCorrectionTo = liveTarget;
    liveRamp = 0;

    pushFrame (uiFrame);
}

AutoTuneEngine::TrackSample AutoTuneEngine::trackAt (double time) const noexcept
{
    if (trackCount == 0)
        return {};

    auto entryAt = [this] (int64_t i) -> const TrackEntry& { return track[(size_t) (i & (trackCapacity - 1))]; };
    auto toSample = [] (const TrackEntry& e) { return TrackSample { e.period, e.correction, e.voiced }; };

    int64_t lo = std::max<int64_t> (0, trackCount - trackCapacity + 1);
    int64_t hi = trackCount - 1;

    if (time >= entryAt (hi).time)
        return toSample (entryAt (hi));

    if (time <= entryAt (lo).time)
        return toSample (entryAt (lo));

    // Entry times increase but are not evenly spaced (they depend on the detected period).
    while (hi - lo > 1)
    {
        const int64_t mid = (lo + hi) / 2;

        if (entryAt (mid).time <= time)
            lo = mid;
        else
            hi = mid;
    }

    const auto& a = entryAt (lo);
    const auto& b = entryAt (hi);
    const auto frac = (float) ((time - a.time) / (b.time - a.time));

    TrackSample s;
    s.voiced = frac < 0.5f ? a.voiced : b.voiced;
    s.correction = a.correction + frac * (b.correction - a.correction);

    if (a.voiced && b.voiced)
        s.period = a.period + frac * (b.period - a.period);
    else
        s.period = a.voiced ? a.period : b.period;

    return s;
}

//==============================================================================
void AutoTuneEngine::pushMark (const Mark& m) noexcept
{
    marks[(size_t) (markCount & markMask)] = m;
    ++markCount;
}

int64_t AutoTuneEngine::oldestMark() const noexcept
{
    return std::max<int64_t> (0, markCount - markCapacity + 16);
}

double AutoTuneEngine::refinePeak (int64_t index) const noexcept
{
    const float ym1 = markPolarity * peakRing[(size_t) ((index - 1) & ringMask)];
    const float y0 = markPolarity * peakRing[(size_t) (index & ringMask)];
    const float yp1 = markPolarity * peakRing[(size_t) ((index + 1) & ringMask)];
    const float curvature = ym1 - 2.0f * y0 + yp1;

    if (curvature >= 0.0f)
        return (double) index;

    return (double) index + juce::jlimit (-0.5, 0.5, 0.5 * (double) (ym1 - yp1) / (double) curvature);
}

void AutoTuneEngine::generateMarks (int64_t newestReadable)
{
    for (int guard = 0; guard < 64; ++guard)
    {
        if (markCount == 0)
        {
            pushMark ({ (double) std::max<int64_t> (0, writePos - 1 - latency - 2 * maxPeriod), (float) unvoicedPeriod, false });
            continue;
        }

        const Mark last = markAt (markCount - 1);
        const double predicted = last.position + (last.voiced ? (double) last.period : (double) unvoicedPeriod);
        const auto info = trackAt (predicted);

        if (! info.voiced || info.period <= 1.0f)
        {
            if (predicted > (double) newestReadable)
                return;

            pushMark ({ predicted, (float) unvoicedPeriod, false });
            continue;
        }

        const double period = info.period;

        if (! last.voiced)
        {
            // Voicing onset: anchor on the strongest excursion within one period and remember
            // its polarity, so later marks land on the same feature of every cycle.
            const auto from = (int64_t) std::ceil (predicted);
            const auto to = from + (int64_t) period;

            if (to + 1 > newestReadable)
                return;

            int64_t best = from;
            float bestMagnitude = -1.0f;

            for (int64_t n = from; n <= to; ++n)
            {
                const float magnitude = std::abs (peakRing[(size_t) (n & ringMask)]);

                if (magnitude > bestMagnitude)
                {
                    bestMagnitude = magnitude;
                    best = n;
                }
            }

            markPolarity = peakRing[(size_t) (best & ringMask)] >= 0.0f ? 1.0f : -1.0f;
            longerSince = -1.0;
            pushMark ({ refinePeak (best), (float) period, true });
            continue;
        }

        // Continuing voiced segment. A detector that briefly locks onto a harmonic or a sub-harmonic
        // changes the period by a whole ratio from one cycle to the next. Real octave leaps do that
        // too, so the waveform decides which spacing the marks follow (once per mark).
        const int64_t newestSample = writePos - 1;
        const double change = period / (double) last.period;
        const bool octave = change < 1.0 / 1.8 || change > 1.8;
        double spacing = period;

        if (octave)
        {
            if (checkedMark != markCount || std::abs (period - checkedPeriod) > 0.05 * checkedPeriod)
            {
                const double shorter = std::min (period, (double) last.period);
                const double longer = std::max (period, (double) last.period);
                const auto expected = (int64_t) std::floor (last.position + longer);
                const auto end = std::min (newestSample, expected + (int64_t) std::lround (longer));

                if (expected + 1 > newestReadable || end < expected + (int64_t) std::lround (0.25 * longer))
                    return;

                checkedMark = markCount;
                checkedPeriod = period;
                checkedSpacing = repeatsAtLonger (end, shorter, longer) ? longer : shorter;
            }

            spacing = checkedSpacing;
        }

        // The detector's slips last a few cycles. Marks still spaced wider than the track after
        // ~30 ms follow the track: reverb or bleed from other notes can fill the comb's bins too.
        const bool longer = octave && checkedSpacing > period;

        if (! longer)
            longerSince = -1.0;
        else if (longerSince < 0.0)
            longerSince = last.position;
        else if (last.position - longerSince > 0.03 * sampleRate)
            spacing = period;

        // Look about one period ahead for the lag at which this cycle best matches the last one.
        // Picking the biggest peak instead jumps between the formant ripples of breathy or low
        // voices. A smaller sudden jump (the detector slipping during a fast glide) widens the
        // search to cover both periods.
        const bool widened = ! octave && (change < 1.0 / 1.15 || change > 1.15);
        const double shortest = widened ? 0.85 * std::min (period, (double) last.period) : 0.8 * spacing;
        const double longest = widened ? 1.15 * std::max (period, (double) last.period) : 1.2 * spacing;

        // Wait until 1.3 periods ahead are readable even though the match needs a little less: the
        // voicing comes from the track, and an earlier look at the end of a note still sees it going on.
        if ((int64_t) std::floor (last.position + std::max (1.3 * spacing, longest + 0.1 * spacing)) + 1 > newestReadable)
            return;

        const int before = (int) std::lround (0.5 * spacing);
        const auto after = (int) juce::jlimit<int64_t> (0, before, newestSample - (int64_t) std::floor (last.position + longest) - 1);
        const double lag = matchCycle (last.position, shortest, longest, spacing, before, after);

        if (widened || (longer && spacing > period))
            spacing = juce::jlimit (2.0, (double) maxPeriod, lag);

        // Each lag carries the previous mark's error forward, and breath noise coloured by the
        // formants biases it slightly every cycle; a gentle pull onto the nearest peak of the
        // onset's polarity keeps the marks from drifting through the cycle.
        auto height = [this] (int64_t n) { return markPolarity * peakRing[(size_t) (n & ringMask)]; };
        double position = last.position + lag;
        const auto start = (int64_t) std::llround (position);
        const auto reach = (int64_t) std::lround (0.25 * spacing);
        auto peak = start;

        while (peak < std::min (start + reach, newestSample - 1) && height (peak + 1) > height (peak))
            ++peak;

        while (peak > start - reach && height (peak - 1) > height (peak))
            --peak;

        position += 0.2 * (refinePeak (peak) - position);
        pushMark ({ position, (float) spacing, true });
    }
}

double AutoTuneEngine::matchCycle (double from, double shortest, double longest, double expected, int before, int after) noexcept
{
    // Normalised cross-correlation of the low-passed signal around `from` with the same stretch
    // `lag` samples later, with a gentle pull toward the expected lag. One copy serves every lag:
    // the reference starts at index 0, the candidate for `lag` at `lag`.
    const auto origin = (int64_t) std::llround (from);
    const int length = before + after;
    const int hi = std::min ((int) std::floor (longest), (int) cycleScratch.size() - length);
    const int lo = std::min ((int) std::ceil (shortest), hi);
    const int64_t first = origin - before;

    for (int i = 0; i < hi + length; ++i)
    {
        const float x = peakRing[(size_t) ((first + i) & ringMask)];
        cycleScratch[(size_t) i] = x;
        cycleEnergy[(size_t) i + 1] = cycleEnergy[(size_t) i] + (double) x * x;
    }

    const double reference = cycleEnergy[(size_t) length];
    const double radius = std::max (1.0, std::max (expected - shortest, longest - expected));

    auto similarity = [&] (int lag)
    {
        const double energy = cycleEnergy[(size_t) (lag + length)] - cycleEnergy[(size_t) lag];
        return (double) dotProduct (cycleScratch.data(), cycleScratch.data() + lag, length) / std::sqrt (reference * energy + 1.0e-20);
    };

    int best = lo;
    double bestScore = -1.0e30, bestSimilarity = 0.0;

    auto consider = [&] (int lag)
    {
        const double s = similarity (lag);
        const double d = ((double) lag - expected) / radius;
        const double score = s - 0.2 * d * d;

        if (score > bestScore)
        {
            bestScore = score;
            bestSimilarity = s;
            best = lag;
        }
    };

    // A coarse pass, then every lag around the winner: the correlation peaks of the low-passed
    // signal are wider than the stride.
    const int stride = std::max (1, (int) std::lround (sampleRate / 12000.0));

    for (int lag = lo; lag <= hi; lag += stride)
        consider (lag);

    const int coarse = best;

    for (int lag = std::max (lo, coarse - stride + 1); lag <= std::min (hi, coarse + stride - 1); ++lag)
        if (lag != coarse)
            consider (lag);

    // Sub-sample refinement on the similarity alone, so the pull doesn't bias the position.
    if (best > lo && best < hi)
    {
        const double a = similarity (best - 1), c = similarity (best + 1);
        const double curvature = a - 2.0 * bestSimilarity + c;

        if (curvature < 0.0)
            return best + juce::jlimit (-0.5, 0.5, 0.5 * (a - c) / curvature);
    }

    return best;
}

bool AutoTuneEngine::repeatsAtLonger (int64_t end, double shorter, double longer) const noexcept
{
    // Harmonics of the long period that the short one doesn't share (h not a multiple of k) only
    // exist if the waveform really repeats at the long period; otherwise those bins hold noise.
    // Only the lowest 2k count: higher up, breath noise rivals the harmonics.
    const int k = std::max (2, (int) std::lround (longer / shorter));
    const int length = (int) std::lround (2.0 * longer);
    double own = 0.0, shared = 0.0;

    for (int h = 1; h <= std::min (16, 2 * k); ++h)
    {
        const double energy = toneEnergy (end, length, h / longer);

        if (h % k == 0)
            shared += energy;
        else
            own += energy;
    }

    return own >= 0.05 * shared;
}

double AutoTuneEngine::toneEnergy (int64_t end, int length, double cyclesPerSample) const noexcept
{
    // One Hann-windowed DFT bin, at any frequency, over the `length` samples ending at `end`.
    const double step = juce::MathConstants<double>::twoPi * cyclesPerSample;
    const double cosStep = std::cos (step), sinStep = std::sin (step);
    const int64_t first = end - length + 1;
    double re = 0.0, im = 0.0, c = 1.0, s = 0.0;

    for (int i = 0; i < length; ++i)
    {
        const double x = (double) detectionRing[(size_t) ((first + i) & ringMask)] * window (std::abs (2.0 * (i + 0.5) / length - 1.0));
        re += x * c;
        im -= x * s;
        const double rotated = c * cosStep - s * sinStep;
        s = s * cosStep + c * sinStep;
        c = rotated;
    }

    return re * re + im * im;
}

int64_t AutoTuneEngine::findSourceMark (double time) noexcept
{
    if (markCount == 0)
        return -1;

    const int64_t oldest = oldestMark();
    int64_t k = juce::jlimit (oldest, markCount - 1, lastSourceMark + 1);

    auto distance = [this, time] (int64_t i) { return std::abs (markAt (i).position - time); };
    auto margin = [this] (int64_t i)
    {
        const auto& m = markAt (i);
        return m.voiced ? 0.1 * m.period : 0.0;
    };

    // Starting from the successor of the last grain's mark, move to whichever mark is nearest.
    // The margin adds hysteresis so a grain halfway between two marks doesn't flip-flop.
    while (k + 1 < markCount && distance (k + 1) + margin (k) < distance (k))
        ++k;

    while (k - 1 >= oldest && distance (k - 1) + margin (k) < distance (k))
        --k;

    return k;
}

//==============================================================================
void AutoTuneEngine::emitGrain (int64_t now)
{
    double centre = synthesisTime;
    double step = unvoicedPeriod;
    double halfLeft = 0.0, halfRight = 0.0;
    double ratio = 1.0;
    bool voiced = false;

    // Voiced grains read whole cycles from the nearest mark, which leaves the output up to about
    // half a period away from the input. Unvoiced grains keep reading at that offset instead of
    // jumping back: the jump would crossfade two copies of the voice that far apart (a comb-filter
    // dip) wherever voicing ends while the voice is still audible, such as a dropout inside a note.
    double offset = lastCentre - lastSource;
    double source = centre - offset;

    // A voiced segment continues from the mark nearest the grain; otherwise look where it reads.
    const double anchor = lastGrainVoiced ? centre : source;
    const int64_t k = findSourceMark (anchor);
    voiceLevel *= std::exp (-lastStep / (voiceRelease * sampleRate));

    if (k >= 0)
    {
        lastSourceMark = k;
        const Mark& m = markAt (k);

        bool useVoiced = m.voiced && std::abs (m.position - anchor) < 1.5 * m.period;

        if (useVoiced && ! lastGrainVoiced)
        {
            // Entering a voiced segment: line the synthesis grid up with the analysis marks (at the
            // offset the unvoiced grains read with) so an uncorrected voice is reproduced exactly.
            // If the segment starts further ahead, keep passing audio through; the unvoiced branch
            // below steps onto the first mark.
            const double ahead = m.position - source;

            if (std::abs (ahead) <= 0.5 * lastStep)
                centre = m.position + offset;
            else if (ahead > 0.0)
                useVoiced = false;
        }

        if (useVoiced)
        {
            const double period = m.period;
            const bool previousVoiced = k - 1 >= oldestMark() && markAt (k - 1).voiced;
            const bool nextVoiced = k + 1 < markCount && markAt (k + 1).voiced;

            // Window halves reach the neighbouring grains, so consecutive halves are complementary
            // (they sum to exactly 1) whenever the spacing is left unchanged.
            double left = lastGrainVoiced ? (previousVoiced ? m.position - markAt (k - 1).position : period)
                                          : centre - lastCentre;
            double right = nextVoiced ? markAt (k + 1).position - m.position : period;
            left = juce::jlimit (0.25 * period, 2.0 * period, left);
            right = juce::jlimit (0.5 * period, 1.5 * period, right);

            // The output period is this mark's period scaled by the correction, so read the
            // correction at the centre of that same period: on fast glides, sampling it anywhere
            // else leaves the note off by the pitch change in between.
            ratio = juce::jlimit (0.5, 2.0, std::exp2 ((double) trackAt (m.position + 0.5 * right).correction / 12.0));
            step = right / ratio;
            source = m.position;

            // The offset a note builds up is still there when voicing ends (or the next note starts)
            // on its tail. Once the note has died away far below the voice, walk the grid back onto
            // the marks, more firmly over the next 10 dB: for a few cycles the period differs by up to
            // 8% (a correction smaller than that is lost), which can't be heard down there, and every
            // grain still lines up with the last.
            const double level = meanSquare (source - period, source + period);

            if (level < voiceLevel * quietLevel)
            {
                const double depth = juce::jlimit (0.0, 1.0, std::log10 (voiceLevel * quietLevel / std::max (level, 1.0e-30)));
                const double realign = depth * maxRealign * right;
                step -= juce::jlimit (-realign, realign, centre - source);
                ratio = juce::jlimit (0.5, 2.0, right / step);
            }

            voiceLevel = std::max (voiceLevel, level);

            // The floor keeps grains overlapping when the pitch is lowered a lot.
            halfLeft = std::max (left / formantStretch, 0.6 * step);
            halfRight = std::max (right / formantStretch, 0.6 * step);
            voiced = true;
        }
    }

    if (! voiced)
    {
        const double left = juce::jlimit (0.25 * unvoicedPeriod, 2.0 * unvoicedPeriod, centre - lastCentre);

        // Where the input is far below the voice that left the offset behind, a jump can't be
        // heard: drop the offset there. Otherwise wind it back a little per grain (after the first,
        // which has to match the last voiced grain), so plain passthrough and the Mix control line
        // up again while each crossfade only mixes copies ~0.1 ms apart. Below 100% Mix, though, the
        // dry signal would comb with the offset copy (flanging) until then, so it goes at once.
        if (std::abs (offset) > 1.0e-9 && (settings.mix < 0.999f || meanSquare (std::min (source, centre) - left, std::max (source, centre)) < voiceLevel * quietLevel))
            offset = 0.0;
        else if (! lastGrainVoiced)
            offset -= juce::jlimit (-unwindRate * unvoicedPeriod, unwindRate * unvoicedPeriod, offset);

        source = centre - offset;

        // Unvoiced audio is passed through grain by grain (source == centre - offset). Look ahead
        // for the first mark of an upcoming voiced segment and divide the distance into even steps
        // so a grain lands exactly on it (at the same offset).
        for (int64_t j = std::max<int64_t> (k - 1, oldestMark()); k >= 0 && j < markCount; ++j)
        {
            const auto& upcoming = markAt (j);
            const double position = upcoming.position + offset;

            if (position <= centre)
                continue;

            if (position > centre + 3.0 * unvoicedPeriod)
                break;

            if (upcoming.voiced)
            {
                const double distance = position - centre;
                const double steps = std::max (1.0, std::ceil (distance / (1.25 * unvoicedPeriod)));
                step = std::max (distance / steps, 0.25 * unvoicedPeriod);
                break;
            }
        }

        halfLeft = std::max (left / formantStretch, 0.6 * left);
        halfRight = std::max (step / formantStretch, 0.6 * step);
    }

    // Packing grains closer raises the level (more overlap); compensate to keep loudness steady.
    const auto gain = (float) juce::jlimit (0.25, 2.0, std::sqrt (formantStretch / ratio));

    writeGrain (now, centre, source, halfLeft, halfRight, gain);

    synthesisTime = centre + step;
    lastCentre = centre;
    lastSource = source;
    lastStep = step;
    lastGrainVoiced = voiced;
}

double AutoTuneEngine::meanSquare (double from, double to) const noexcept
{
    const auto first = (int64_t) std::floor (from);
    const auto last = std::min<int64_t> ((int64_t) std::ceil (to), writePos - 1);
    double sum = 0.0;

    for (int64_t i = first; i <= last; ++i)
    {
        const float x = detectionRing[(size_t) (i & ringMask)];
        sum += (double) x * x;
    }

    return last >= first ? sum / (double) (last - first + 1) : 0.0;
}

float AutoTuneEngine::window (double x) const noexcept
{
    if (x >= 1.0)
        return 0.0f;

    const double position = x * windowTableSize;
    const auto index = (size_t) position;
    const auto frac = (float) (position - (double) index);
    return windowTable[index] + frac * (windowTable[index + 1] - windowTable[index]);
}

void AutoTuneEngine::writeGrain (int64_t now, double centre, double source, double halfLeft, double halfRight, float gain)
{
    const int64_t first = std::max (now, (int64_t) std::ceil (centre - halfLeft));
    const auto last = (int64_t) std::floor (centre + halfRight);
    const double newestReadable = (double) writePos - 3.0;
    const double oldestReadable = (double) (writePos - ringSize + 2);

    for (int64_t u = first; u <= last; ++u)
    {
        const double offset = (double) u - centre;
        const double readPosition = source + offset * formantStretch;

        if (readPosition > newestReadable)
            break;

        if (readPosition < oldestReadable)
            continue;

        const float w = offset < 0.0 ? window (-offset / halfLeft) : window (offset / halfRight);

        if (w <= 0.0f)
            continue;

        const float g = gain * w;
        const auto slot = (size_t) (u & ringMask);

        for (int c = 0; c < activeChannels; ++c)
            outputRing[(size_t) c][slot] += g * readInterpolated (inputRing[(size_t) c].data(), ringMask, readPosition);
    }
}

//==============================================================================
void AutoTuneEngine::pushFrame (const PitchFrame& pitchFrame) noexcept
{
    const auto scope = frameFifo.write (1);

    if (scope.blockSize1 > 0)
        frameBuffer[(size_t) scope.startIndex1] = pitchFrame;
    else if (scope.blockSize2 > 0)
        frameBuffer[(size_t) scope.startIndex2] = pitchFrame;
}

int AutoTuneEngine::popFrames (PitchFrame* destination, int maxFrames)
{
    const auto scope = frameFifo.read (std::min (maxFrames, frameFifo.getNumReady()));
    int count = 0;

    for (int i = 0; i < scope.blockSize1; ++i)
        destination[count++] = frameBuffer[(size_t) (scope.startIndex1 + i)];

    for (int i = 0; i < scope.blockSize2; ++i)
        destination[count++] = frameBuffer[(size_t) (scope.startIndex2 + i)];

    return count;
}
} // namespace snaptune
