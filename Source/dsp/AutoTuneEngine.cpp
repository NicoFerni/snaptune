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

    wasVoiced = false;
    currentTarget = -1;
    correction = 0.0f;
    noteAge = 0.0f;
    trackCount = 0;
    lastTrackTime = -1.0e12;
    stampPeriod = 0.5f * (float) maxPeriod;

    markCount = 0;
    markPolarity = 1.0f;

    synthesisTime = 0.0;
    lastCentre = -unvoicedPeriod;
    lastStep = unvoicedPeriod;
    lastSourceMark = -1;
    lastGrainVoiced = false;

    // The next sample written lands at index writePos; read `latency` samples behind it.
    liveTap = (double) (writePos - liveLatency);
    fadeLength = fadePosition = 0;
    liveCorrectionFrom = liveCorrectionTo = 0.0;
    liveRamp = hopSize;
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
    synthesisTime = now;
    lastCentre = now - unvoicedPeriod;
    lastStep = unvoicedPeriod;
    lastSourceMark = -1;
    lastGrainVoiced = false;

    liveTap = now;
    fadeLength = fadePosition = 0;

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
            liveTap += ratio;
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

    if (voiced && delay < liveMinDelay + 1.5 * maxPeriod)
    {
        // Reading faster than the input arrives (pitch up) eventually catches up with the newest
        // sample: jump back one cycle and repeat it. Reading slower (pitch down) falls behind: jump
        // forward one cycle and skip it. Jumping by exactly one period of a periodic signal is
        // seamless; the cross-correlation search finds that period at the read point.
        const double period = latest.period;
        double fade = juce::jlimit (16.0, 0.006 * sampleRate, 0.5 * period);

        if (std::abs (ratio - 1.0) > 1.0e-9)
            fade = std::min (fade, 0.9 * period / std::abs (ratio - 1.0));

        if (ratio > 1.0 && delay < liveMinDelay + (ratio - 1.0) * fade + 2.0)
            startSplice (-findSpliceLength (liveTap, -1, 0.8 * period, 1.25 * period, period), fade, false);
        else if (ratio < 1.0 && delay > liveMinDelay + 1.25 * period + 2.0)
            startSplice (findSpliceLength (liveTap, 1, 0.8 * period, std::min (1.25 * period, delay - liveMinDelay - 2.0), period), fade, false);

        return;
    }

    // No pitch to stay in phase with: drift back to the reported latency so Mix and the host's
    // delay compensation stay aligned. Unpitched audio is uncorrelated, hence equal-power.
    if (std::abs (delay - liveLatency) > 0.25 * unvoicedPeriod)
        startSplice (delay - liveLatency, 0.005 * sampleRate, true);
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

    for (int length = lo; length <= hi; ++length)
    {
        const double score = similarity (length);

        if (score > bestScore)
        {
            bestScore = score;
            best = length;
        }
    }

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
    // audio about 5 ms old instead of ~10 ms.
    const bool live = activeMode == LatencyMode::live;
    int window = maxPeriod;

    if (live)
    {
        const double reference = wasVoiced ? (double) stampPeriod : 0.5 * maxPeriodForVoice;
        window = (int) juce::jlimit (0.35 * maxPeriod, (double) maxPeriod, 1.5 * reference);
    }

    const auto result = detector.analyse (frame.data(), minPeriod, maxPeriodForVoice, pickThreshold, window);

    // Hysteresis on both the level gate and the periodicity threshold keeps the voicing
    // decision from chattering at the ends of notes.
    // The level gate only has to ignore near-silence (-76 dBFS); the periodicity test is what
    // rejects noise. A higher gate cuts quiet mic signals into fragments.
    const float gate = wasVoiced ? 0.0001f : 0.00016f;
    const float aperiodicityLimit = wasVoiced ? voicedThreshold + 0.1f : voicedThreshold;
    bool voiced = result.period > 0.0f && result.rms > gate && result.aperiodicity < aperiodicityLimit;

    // Pitch continuity: during a note, a frame whose period matches the one being tracked is still
    // the voice even if breath, room sound or jitter push it a little over the limit. Without this,
    // real (and especially low, roomy) voices drop out for 15-35 ms at a time.
    if (! voiced && wasVoiced && recentCount > 0 && result.period > 0.0f && result.rms > gate
        && result.aperiodicity < aperiodicityLimit + 0.2f && std::abs (std::log2 (result.period / recentPeriods[2])) < 0.03f)
        voiced = true;

    float period = result.period;
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

        const int target = chooseTargetNote (inputNote, mask, currentTarget, 0.12f);

        if (! wasVoiced || target != currentTarget)
            noteAge = 0.0f;
        else
            noteAge += hopSeconds;

        // Notes start uncorrected and glide onto the target at the retune speed.
        if (! wasVoiced)
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
    }
    else
    {
        correction = 0.0f;
        currentTarget = -1;
        noteAge = 0.0f;
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
    double liveTarget = correction;

    if (continuingNote && currentTarget == previousTarget && trackCount >= 2)
    {
        const auto& previous = track[(size_t) ((trackCount - 2) & (trackCapacity - 1))];
        const double span = entry.time - previous.time;

        if (previous.voiced && span > 0.0)
        {
            const double ahead = liveTap + hopSize - entry.time;
            liveTarget += juce::jlimit (-0.3, 0.3, (double) (entry.correction - previous.correction) / span * ahead);
        }
    }

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
            pushMark ({ refinePeak (best), (float) period, true });
            continue;
        }

        // Continuing voiced segment: search around one period ahead for the matching peak, with
        // a gentle pull toward the predicted position so neighbouring peaks don't cause jitter.
        const double centre = last.position + period;
        const double radius = 0.3 * period;
        const auto from = (int64_t) std::ceil (centre - radius);
        const auto to = (int64_t) std::floor (centre + radius);

        if (to + 1 > newestReadable)
            return;

        float peakMagnitude = 1.0e-9f;

        for (int64_t n = from; n <= to; ++n)
            peakMagnitude = std::max (peakMagnitude, std::abs (peakRing[(size_t) (n & ringMask)]));

        int64_t best = from;
        float bestScore = -1.0e30f;

        for (int64_t n = from; n <= to; ++n)
        {
            const auto distance = (float) (((double) n - centre) / radius);
            const float score = markPolarity * peakRing[(size_t) (n & ringMask)] - 0.5f * peakMagnitude * distance * distance;

            if (score > bestScore)
            {
                bestScore = score;
                best = n;
            }
        }

        pushMark ({ refinePeak (best), (float) period, true });
    }
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
    double source = centre;
    double halfLeft = 0.0, halfRight = 0.0;
    double ratio = 1.0;
    bool voiced = false;

    const int64_t k = findSourceMark (centre);

    if (k >= 0)
    {
        lastSourceMark = k;
        const Mark& m = markAt (k);

        bool useVoiced = m.voiced && std::abs (m.position - centre) < 1.5 * m.period;

        if (useVoiced && ! lastGrainVoiced)
        {
            // Entering a voiced segment: line the synthesis grid up with the analysis marks so an
            // uncorrected voice is reproduced exactly. If the segment starts further ahead, keep
            // passing audio through; the unvoiced branch below steps onto the first mark.
            const double ahead = m.position - centre;

            if (std::abs (ahead) <= 0.5 * lastStep)
                centre = m.position;
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

            // The floor keeps grains overlapping when the pitch is lowered a lot.
            halfLeft = std::max (left / formantStretch, 0.6 * step);
            halfRight = std::max (right / formantStretch, 0.6 * step);
            voiced = true;
        }
    }

    if (! voiced)
    {
        // Unvoiced audio is passed through grain by grain (source == centre). Look ahead for the
        // first mark of an upcoming voiced segment and divide the distance into even steps so a
        // grain lands exactly on it.
        for (int64_t j = std::max<int64_t> (k - 1, oldestMark()); k >= 0 && j < markCount; ++j)
        {
            const auto& upcoming = markAt (j);

            if (upcoming.position <= centre)
                continue;

            if (upcoming.position > centre + 3.0 * unvoicedPeriod)
                break;

            if (upcoming.voiced)
            {
                const double distance = upcoming.position - centre;
                const double steps = std::max (1.0, std::ceil (distance / (1.25 * unvoicedPeriod)));
                step = std::max (distance / steps, 0.25 * unvoicedPeriod);
                break;
            }
        }

        const double left = juce::jlimit (0.25 * unvoicedPeriod, 2.0 * unvoicedPeriod, centre - lastCentre);
        halfLeft = std::max (left / formantStretch, 0.6 * left);
        halfRight = std::max (step / formantStretch, 0.6 * step);
    }

    // Packing grains closer raises the level (more overlap); compensate to keep loudness steady.
    const auto gain = (float) juce::jlimit (0.25, 2.0, std::sqrt (formantStretch / ratio));

    writeGrain (now, centre, source, halfLeft, halfRight, gain);

    synthesisTime = centre + step;
    lastCentre = centre;
    lastStep = step;
    lastGrainVoiced = voiced;
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
