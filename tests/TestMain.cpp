// Offline test runner for SnapTune.
//
//   SnapTuneTests [--out <dir>]                 DSP test suite (+ demo WAVs when --out is given)
//   SnapTuneTests --process <in> <out> [opts]   tune an audio file: --key C --scale Major --retune 0 --formant 0
//   SnapTuneTests --host <plugin path>          load the built VST3 / AU and check it corrects pitch
//   SnapTuneTests --snapshot <out.png> [studio|live] [uiScale] [pixelScale]
//                                               render the editor with real pitch data (pixelScale 2 = Retina)

#include "Parameters.h"
#include "PluginEditor.h"
#include "PluginProcessor.h"
#include "UpdateCheck.h"
#include "dsp/AutoTuneEngine.h"
#include "dsp/PitchDetector.h"

#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_basics/juce_gui_basics.h>

#include <algorithm>
#include <chrono>
#include <complex>
#include <cstdio>
#include <functional>
#include <numeric>
#include <random>
#include <set>

using namespace snaptune;

namespace
{
int failures = 0;

void check (bool ok, const juce::String& name, const juce::String& detail)
{
    std::printf ("[%s] %-46s %s\n", ok ? "PASS" : "FAIL", name.toRawUTF8(), detail.toRawUTF8());

    if (! ok)
        ++failures;
}

double midiToHz (double note) { return 440.0 * std::pow (2.0, (note - 69.0) / 12.0); }
double hzToMidi (double hz) { return 69.0 + 12.0 * std::log2 (hz / 440.0); }

double percentile (std::vector<double> v, double p)
{
    if (v.empty())
        return 0.0;

    std::sort (v.begin(), v.end());
    return v[(size_t) std::clamp ((int) std::lround (p * (double) (v.size() - 1)), 0, (int) v.size() - 1)];
}

double mean (const std::vector<double>& v) { return v.empty() ? 0.0 : std::accumulate (v.begin(), v.end(), 0.0) / (double) v.size(); }

double stddev (const std::vector<double>& v)
{
    const double m = mean (v);
    double acc = 0.0;

    for (auto x : v)
        acc += (x - m) * (x - m);

    return v.size() > 1 ? std::sqrt (acc / (double) (v.size() - 1)) : 0.0;
}

//==============================================================================
// Synthetic singer: band-limited harmonic source (1/k roll-off, i.e. glottal flow + lip radiation)
// through a cascade of formant resonators, with a little breath noise.
struct Vowel
{
    double frequency[4];
    double bandwidth[4];
};

const Vowel vowelA { { 730.0, 1090.0, 2440.0, 3400.0 }, { 80.0, 90.0, 120.0, 150.0 } };

struct Resonator
{
    double a1 = 0, a2 = 0, b0 = 0, y1 = 0, y2 = 0;

    Resonator (double frequency, double bandwidth, double sampleRate)
    {
        const double r = std::exp (-juce::MathConstants<double>::pi * bandwidth / sampleRate);
        a1 = 2.0 * r * std::cos (juce::MathConstants<double>::twoPi * frequency / sampleRate);
        a2 = -r * r;
        b0 = 1.0 - a1 - a2; // unity gain at DC
    }

    double process (double x)
    {
        const double y = b0 * x + a1 * y1 + a2 * y2;
        y2 = y1;
        y1 = y;
        return y;
    }
};

/** f0 (t) returns the pitch in Hz, or <= 0 for silence. */
std::vector<float> renderVoice (double sampleRate, double seconds, const std::function<double (double)>& f0, const Vowel& vowel = vowelA,
                                double breath = 0.004)
{
    const auto n = (size_t) (seconds * sampleRate);
    std::vector<float> out (n);
    std::vector<Resonator> tract;

    for (int i = 0; i < 4; ++i)
        tract.emplace_back (vowel.frequency[i], vowel.bandwidth[i], sampleRate);

    std::mt19937 rng (1234);
    std::normal_distribution<double> noise (0.0, 1.0);
    double phase = 0.0, envelope = 0.0, lastFrequency = 220.0;
    const double attack = 1.0 - std::exp (-1.0 / (0.012 * sampleRate));
    const double release = 1.0 - std::exp (-1.0 / (0.02 * sampleRate));

    for (size_t i = 0; i < n; ++i)
    {
        const double t = (double) i / sampleRate;
        const double f = f0 (t);
        const double target = f > 0.0 ? 1.0 : 0.0;
        envelope += (target - envelope) * (target > envelope ? attack : release);

        if (f > 0.0)
            lastFrequency = f;

        double source = 0.0;

        if (envelope > 1.0e-5)
        {
            phase += lastFrequency / sampleRate;
            phase -= std::floor (phase);
            const int harmonics = std::min (60, (int) (0.45 * sampleRate / lastFrequency));

            for (int k = 1; k <= harmonics; ++k)
                source += std::sin (juce::MathConstants<double>::twoPi * k * phase) / k;

            source = envelope * (source + breath * noise (rng));
        }

        double y = source;

        for (auto& r : tract)
            y = r.process (y);

        out[i] = (float) y;
    }

    float peak = 1.0e-9f;

    for (auto x : out)
        peak = std::max (peak, std::abs (x));

    for (auto& x : out)
        x *= 0.5f / peak;

    return out;
}

struct SungNote
{
    double start, end, note, cents, vibratoCents = 0.0, scoopCents = 0.0;
};

// An off-key performance: every note misses its pitch by 15-40 cents, one has vibrato, one scoops up.
const std::vector<SungNote> offKeyMelody {
    { 0.10, 1.00, 57, +35 },          // A3, 35 cents sharp
    { 1.15, 2.05, 60, -28 },          // C4, flat
    { 2.20, 3.40, 64, +22, 25.0 },    // E4, sharp, with vibrato
    { 3.55, 4.40, 55, -40 },          // G3, very flat
    { 4.55, 5.50, 62, +15, 0.0, -100 } // D4, scooping up from a semitone below
};

std::function<double (double)> melodyPitch (const std::vector<SungNote>& notes)
{
    return [notes] (double t)
    {
        for (const auto& n : notes)
        {
            if (t >= n.start && t < n.end)
            {
                double cents = n.cents + n.vibratoCents * std::sin (juce::MathConstants<double>::twoPi * 5.5 * (t - n.start));

                if (n.scoopCents != 0.0)
                    cents += n.scoopCents * std::max (0.0, 1.0 - (t - n.start) / 0.15);

                return midiToHz (n.note + cents / 100.0);
            }
        }

        return 0.0;
    };
}

//==============================================================================
// Independent reference pitch tracker (plain time-domain YIN in double precision).
struct PitchPoint
{
    double time, hz, aperiodicity;
};

std::vector<PitchPoint> trackPitch (const std::vector<float>& x, double sampleRate, double minHz = 60.0, double maxHz = 1300.0,
                                   double windowSeconds = 0.025, double hopSeconds = 0.005)
{
    const int window = (int) (windowSeconds * sampleRate);
    const int maxLag = (int) std::ceil (sampleRate / minHz) + 2;
    const int minLag = (int) std::floor (sampleRate / maxHz);
    const int hop = (int) (hopSeconds * sampleRate);
    std::vector<PitchPoint> points;
    std::vector<double> d ((size_t) maxLag + 1), cmnd ((size_t) maxLag + 1);

    for (int start = 0; start + window + maxLag < (int) x.size(); start += hop)
    {
        double energy = 0.0;

        for (int j = 0; j < window; ++j)
            energy += (double) x[(size_t) (start + j)] * x[(size_t) (start + j)];

        if (energy / window < 1.0e-6)
            continue;

        double running = 0.0;
        cmnd[0] = 1.0;

        for (int tau = 1; tau <= maxLag; ++tau)
        {
            double sum = 0.0;

            for (int j = 0; j < window; ++j)
            {
                const double diff = (double) x[(size_t) (start + j)] - x[(size_t) (start + j + tau)];
                sum += diff * diff;
            }

            d[(size_t) tau] = sum;
            running += sum;
            cmnd[(size_t) tau] = running > 0.0 ? sum * tau / running : 1.0;
        }

        int best = -1;

        for (int tau = minLag; tau < maxLag; ++tau)
        {
            if (cmnd[(size_t) tau] < 0.1)
            {
                while (tau + 1 < maxLag && cmnd[(size_t) tau + 1] < cmnd[(size_t) tau])
                    ++tau;

                best = tau;
                break;
            }
        }

        if (best < 0)
            continue;

        const double a = d[(size_t) best - 1], b = d[(size_t) best], c = d[(size_t) best + 1];
        const double curvature = a - 2.0 * b + c;
        const double period = best + (curvature > 0.0 ? std::clamp (0.5 * (a - c) / curvature, -0.5, 0.5) : 0.0);
        points.push_back ({ (start + window * 0.5 + period * 0.5) / sampleRate, sampleRate / period, cmnd[(size_t) best] });
    }

    return points;
}

/** Cents error of the output against an expected note over a time range. */
std::vector<double> centsInRange (const std::vector<PitchPoint>& track, double from, double to, double expectedNote)
{
    std::vector<double> errors;

    for (const auto& p : track)
        if (p.time >= from && p.time <= to)
            errors.push_back (100.0 * (hzToMidi (p.hz) - expectedNote));

    return errors;
}

//==============================================================================
// Formants from LPC: decimate to 12 kHz, average the LPC envelope over a segment, pick the peaks.
std::pair<double, double> estimateFormants (const std::vector<float>& x, double sampleRate, double fromSec, double toSec)
{
    const int factor = (int) std::lround (sampleRate / 12000.0);
    const double rate = sampleRate / factor;
    const int taps = 95;
    std::vector<double> fir ((size_t) taps);

    for (int i = 0; i < taps; ++i)
    {
        const double m = i - (taps - 1) * 0.5;
        const double cutoff = 5000.0 / sampleRate;
        const double sinc = m == 0.0 ? 2.0 * cutoff : std::sin (juce::MathConstants<double>::twoPi * cutoff * m) / (juce::MathConstants<double>::pi * m);
        fir[(size_t) i] = sinc * (0.54 - 0.46 * std::cos (juce::MathConstants<double>::twoPi * i / (taps - 1)));
    }

    std::vector<double> y;

    for (auto n = (int) (fromSec * sampleRate); n + taps < (int) (toSec * sampleRate) && n + taps < (int) x.size(); n += factor)
    {
        double acc = 0.0;

        for (int i = 0; i < taps; ++i)
            acc += fir[(size_t) i] * x[(size_t) (n + i)];

        y.push_back (acc);
    }

    const int order = 12, frameLength = 512, hop = 256, bins = 1000;
    std::vector<double> logEnvelope ((size_t) bins, 0.0);

    for (int start = 0; start + frameLength < (int) y.size(); start += hop)
    {
        std::vector<double> frame ((size_t) frameLength);

        for (int i = 0; i < frameLength; ++i)
        {
            const double pre = y[(size_t) (start + i)] - (start + i > 0 ? 0.97 * y[(size_t) (start + i - 1)] : 0.0);
            frame[(size_t) i] = pre * (0.54 - 0.46 * std::cos (juce::MathConstants<double>::twoPi * i / (frameLength - 1)));
        }

        std::vector<double> r ((size_t) order + 1, 0.0);

        for (int lag = 0; lag <= order; ++lag)
            for (int i = lag; i < frameLength; ++i)
                r[(size_t) lag] += frame[(size_t) i] * frame[(size_t) (i - lag)];

        if (r[0] <= 0.0)
            continue;

        // Levinson-Durbin.
        std::vector<double> a ((size_t) order + 1, 0.0), tmp ((size_t) order + 1);
        a[0] = 1.0;
        double error = r[0];

        for (int i = 1; i <= order; ++i)
        {
            double acc = r[(size_t) i];

            for (int j = 1; j < i; ++j)
                acc += a[(size_t) j] * r[(size_t) (i - j)];

            const double k = -acc / error;
            tmp = a;

            for (int j = 1; j < i; ++j)
                a[(size_t) j] = tmp[(size_t) j] + k * tmp[(size_t) (i - j)];

            a[(size_t) i] = k;
            error *= (1.0 - k * k);
        }

        for (int b = 0; b < bins; ++b)
        {
            const double w = juce::MathConstants<double>::twoPi * (b * 5.0) / rate;
            std::complex<double> denominator (0.0, 0.0);

            for (int j = 0; j <= order; ++j)
                denominator += a[(size_t) j] * std::polar (1.0, -w * j);

            logEnvelope[(size_t) b] += -std::log (std::norm (denominator));
        }

    }

    std::vector<double> peaks;

    for (int b = 1; b + 1 < bins; ++b)
        if (b * 5.0 > 250.0 && logEnvelope[(size_t) b] > logEnvelope[(size_t) b - 1] && logEnvelope[(size_t) b] >= logEnvelope[(size_t) b + 1])
            peaks.push_back (b * 5.0);

    return { peaks.size() > 0 ? peaks[0] : 0.0, peaks.size() > 1 ? peaks[1] : 0.0 };
}

//==============================================================================
/** Runs the engine over a mono signal and returns the output aligned to the input (latency removed). */
std::vector<float> runEngine (const std::vector<float>& in, double sampleRate, const EngineSettings& settings,
                              const std::function<void (AutoTuneEngine&)>& setup = {}, int blockSize = 256,
                              double* secondsTaken = nullptr, std::vector<PitchFrame>* frames = nullptr)
{
    AutoTuneEngine engine;
    engine.setSettings (settings);
    engine.prepare (sampleRate, 1);

    if (setup)
        setup (engine);

    const int latency = engine.getLatencySamples();
    std::vector<float> buffer (in.size() + (size_t) latency, 0.0f);
    std::copy (in.begin(), in.end(), buffer.begin());

    const auto started = std::chrono::steady_clock::now();

    for (size_t pos = 0; pos < buffer.size(); pos += (size_t) blockSize)
    {
        float* channel = buffer.data() + pos;
        engine.process (&channel, 1, 0, (int) std::min<size_t> ((size_t) blockSize, buffer.size() - pos));

        if (frames != nullptr)
        {
            PitchFrame chunk[256];

            for (int count; (count = engine.popFrames (chunk, 256)) > 0;)
                frames->insert (frames->end(), chunk, chunk + count);
        }
    }

    if (secondsTaken != nullptr)
        *secondsTaken = std::chrono::duration<double> (std::chrono::steady_clock::now() - started).count();

    return { buffer.begin() + latency, buffer.end() };
}

double snrDb (const std::vector<float>& reference, const std::vector<float>& test, size_t from, size_t to)
{
    double signal = 0.0, noise = 0.0;

    for (size_t i = from; i < std::min ({ to, reference.size(), test.size() }); ++i)
    {
        signal += (double) reference[i] * reference[i];
        noise += ((double) test[i] - reference[i]) * ((double) test[i] - reference[i]);
    }

    return 10.0 * std::log10 (signal / std::max (noise, 1.0e-30));
}

void writeWav (const juce::File& file, const std::vector<float>& samples, double sampleRate)
{
    file.deleteFile();
    juce::WavAudioFormat wav;
    std::unique_ptr<juce::OutputStream> stream = std::make_unique<juce::FileOutputStream> (file);
    auto options = juce::AudioFormatWriterOptions().withSampleRate (sampleRate).withNumChannels (1).withBitsPerSample (24);

    if (auto writer = wav.createWriterFor (stream, options))
    {
        const float* channel = samples.data();
        writer->writeFromFloatArrays (&channel, 1, (int) samples.size());
    }
}

EngineSettings hardTune()
{
    EngineSettings s;
    s.retuneMs = 0.0f;
    s.scale = Scale::chromatic;
    return s;
}

//==============================================================================
void testVersionCompare()
{
    using snaptune::isNewerVersion;
    const bool ok = isNewerVersion ("2.1.0", "2.0.0") && isNewerVersion ("2.0.1", "2.0.0") && isNewerVersion ("10.0.0", "9.9.9")
                 && isNewerVersion ("2.1", "2.0.9") && ! isNewerVersion ("2.0.0", "2.0.0") && ! isNewerVersion ("1.9.9", "2.0.0")
                 && ! isNewerVersion ("", "2.0.0") && ! isNewerVersion ("<html>", "2.0.0") && ! isNewerVersion ("2.0", "2.0.0");
    check (ok, "Update notice: version comparison", "newer, equal, older, short and malformed versions");
}

void testDetector()
{
    for (double hz : { 70.0, 98.0, 147.0, 220.0, 330.0, 523.25, 880.0, 1175.0 })
    {
        const double sampleRate = 48000.0;
        const auto signal = renderVoice (sampleRate, 0.4, [hz] (double) { return hz; });
        PitchDetector detector;
        const int maxPeriod = (int) std::ceil (sampleRate / 65.0);
        detector.prepare (maxPeriod, maxPeriod + 2);
        const auto result = detector.analyse (signal.data() + (int) (0.2 * sampleRate), (float) (sampleRate / 1600.0), (float) maxPeriod, 0.15f);
        const double cents = 100.0 * (hzToMidi (sampleRate / result.period) - hzToMidi (hz));
        check (std::abs (cents) < 1.0 && result.aperiodicity < 0.1, "YIN detector @ " + juce::String (hz, 1) + " Hz",
               "error " + juce::String (cents, 3) + " ct, aperiodicity " + juce::String (result.aperiodicity, 3));
    }
}

void testHardTune (double sampleRate, const juce::File& outDir)
{
    const auto input = renderVoice (sampleRate, 5.7, melodyPitch (offKeyMelody));
    const auto output = runEngine (input, sampleRate, hardTune());
    const auto inTrack = trackPitch (input, sampleRate);
    const auto outTrack = trackPitch (output, sampleRate);

    std::vector<double> inErrors, outErrors;

    for (const auto& n : offKeyMelody)
    {
        const auto a = centsInRange (inTrack, n.start + 0.2, n.end - 0.1, n.note);
        const auto b = centsInRange (outTrack, n.start + 0.2, n.end - 0.1, n.note);

        for (auto e : a)
            inErrors.push_back (std::abs (e));

        for (auto e : b)
            outErrors.push_back (std::abs (e));
    }

    const juce::String rate (sampleRate / 1000.0, 1);
    check (percentile (outErrors, 0.5) < 3.0 && percentile (outErrors, 0.95) < 10.0 && outErrors.size() > 500,
           "Hard tune lands on the notes @ " + rate + " kHz",
           "input |err| median " + juce::String (percentile (inErrors, 0.5), 1) + " ct -> output median "
               + juce::String (percentile (outErrors, 0.5), 2) + " ct, p95 " + juce::String (percentile (outErrors, 0.95), 2) + " ct ("
               + juce::String ((int) outErrors.size()) + " frames)");

    if (outDir.isDirectory() && sampleRate == 48000.0)
    {
        writeWav (outDir.getChildFile ("melody_input.wav"), input, sampleRate);
        writeWav (outDir.getChildFile ("melody_hardtune.wav"), output, sampleRate);
    }
}

void testRetuneSpeed (const juce::File& outDir, LatencyMode mode)
{
    const double sampleRate = 48000.0;
    const auto input = renderVoice (sampleRate, 5.7, melodyPitch (offKeyMelody));
    const auto& vibratoNote = offKeyMelody[2];

    auto measure = [&] (float retuneMs, std::vector<float>* keep)
    {
        auto settings = hardTune();
        settings.retuneMs = retuneMs;
        settings.mode = mode;
        const auto output = runEngine (input, sampleRate, settings);

        if (keep != nullptr)
            *keep = output;

        return centsInRange (trackPitch (output, sampleRate), vibratoNote.start + 0.4, vibratoNote.end - 0.1, vibratoNote.note);
    };

    std::vector<float> natural;
    const auto inputCents = centsInRange (trackPitch (input, sampleRate), vibratoNote.start + 0.4, vibratoNote.end - 0.1, vibratoNote.note);
    const auto hard = measure (0.0f, nullptr);
    const auto slow = measure (200.0f, &natural);

    check (stddev (hard) < 4.0 && stddev (slow) > 0.6 * stddev (inputCents) && std::abs (mean (slow)) < 8.0,
           juce::String ("Retune speed (") + (mode == LatencyMode::live ? "Live" : "Studio") + "): 0 ms flattens, 200 ms keeps vibrato",
           "vibrato depth (std) input " + juce::String (stddev (inputCents), 1) + " ct, hard " + juce::String (stddev (hard), 1)
               + " ct, 200 ms " + juce::String (stddev (slow), 1) + " ct; mean offset in " + juce::String (mean (inputCents), 1)
               + " -> 200 ms " + juce::String (mean (slow), 1) + " ct");

    if (outDir.isDirectory() && mode == LatencyMode::studio)
        writeWav (outDir.getChildFile ("melody_retune200ms.wav"), natural, sampleRate);
}

void testScaleSnapping()
{
    const double sampleRate = 48000.0;
    // Continuous glide from G3 to E4 over 3 s.
    const auto input = renderVoice (sampleRate, 3.4, [] (double t)
                                    { return t < 0.2 || t > 3.2 ? 0.0 : midiToHz (55.0 + 9.0 * (t - 0.2) / 3.0); });

    auto settings = hardTune();
    settings.key = 0;
    settings.scale = Scale::major;
    const auto output = runEngine (input, sampleRate, settings);
    const auto mask = pitchClassMask (0, Scale::major, 0);

    int onScale = 0, total = 0;
    std::set<int> visited;

    for (const auto& p : trackPitch (output, sampleRate))
    {
        if (p.time < 0.35 || p.time > 3.1)
            continue;

        const double note = hzToMidi (p.hz);
        const int nearest = nearestAllowedNote ((float) note, mask);
        ++total;

        if (std::abs (note - nearest) * 100.0 < 15.0)
        {
            ++onScale;
            visited.insert (nearest);
        }
    }

    juce::StringArray names;

    for (int n : visited)
        names.add (juce::String (noteName (n)) + juce::String (noteOctave (n)));

    const double fraction = total > 0 ? (double) onScale / total : 0.0;
    check (fraction > 0.85 && visited.size() >= 6, "C major: a glide becomes a staircase",
           juce::String (100.0 * fraction, 1) + "% of frames within 15 ct of a C-major note; steps: " + names.joinIntoString (" "));
}

void testFastGlide (LatencyMode mode)
{
    // A 20 semitone-per-second fall (a fast ornament) should still come out as clean steps.
    const double sampleRate = 48000.0;
    const auto input = renderVoice (sampleRate, 0.75, [] (double t) { return t < 0.1 || t > 0.6 ? 0.0 : midiToHz (54.0 - 10.0 * (t - 0.1) / 0.5); });
    auto settings = hardTune();
    settings.scale = Scale::major;
    settings.mode = mode;
    const auto output = runEngine (input, sampleRate, settings);
    const auto mask = pitchClassMask (0, Scale::major, 0);

    // Short analysis window (6 ms) so 25-50 ms steps are resolved instead of averaged into a slope.
    std::vector<double> errors;

    for (const auto& p : trackPitch (output, sampleRate, 125.0, 1300.0, 0.006, 0.001))
    {
        if (p.time < 0.15 || p.time > 0.55)
            continue;

        const double note = hzToMidi (p.hz);
        errors.push_back (std::abs (note - nearestAllowedNote ((float) note, mask)) * 100.0);
    }

    check (percentile (errors, 0.5) < 5.0 && percentile (errors, 0.75) < 10.0,
           juce::String ("Fast glide (20 st/s) snaps to C major, ") + (mode == LatencyMode::live ? "Live" : "Studio"),
           "distance to nearest scale note: median " + juce::String (percentile (errors, 0.5), 1) + " ct, p75 "
               + juce::String (percentile (errors, 0.75), 1) + " ct (" + juce::String ((int) errors.size()) + " frames, transitions included)");
}

void testFormantsAndMidi (const juce::File& outDir)
{
    const double sampleRate = 48000.0;
    const auto input = renderVoice (sampleRate, 2.0, [] (double t) { return t < 0.1 || t > 1.9 ? 0.0 : 220.0; });

    auto settings = hardTune();
    settings.midiTargets = true;
    const auto output = runEngine (input, sampleRate, settings, [] (AutoTuneEngine& e) { e.noteOn (64); }); // hold an E

    const auto outTrack = trackPitch (output, sampleRate);
    const auto errors = centsInRange (outTrack, 0.4, 1.8, 52.0); // nearest E to A3 is E3, 5 semitones down
    check (! errors.empty() && std::abs (percentile (errors, 0.5)) < 5.0, "MIDI target: A3 is pulled to the held E (E3)",
           "output median " + juce::String (percentile (errors, 0.5), 2) + " ct from E3 (" + juce::String ((int) errors.size()) + " frames)");

    // A naive resampler shifts the formants with the pitch; PSOLA should leave them in place.
    const double ratio = midiToHz (52.0) / 220.0;
    std::vector<float> resampled;

    for (double pos = 0.0; pos + 1.0 < (double) input.size(); pos += ratio)
    {
        const auto i = (size_t) pos;
        const auto frac = (float) (pos - (double) i);
        resampled.push_back (input[i] + frac * (input[i + 1] - input[i]));
    }

    const auto fIn = estimateFormants (input, sampleRate, 0.5, 1.7);
    const auto fOut = estimateFormants (output, sampleRate, 0.5, 1.7);
    const auto fNaive = estimateFormants (resampled, sampleRate, 0.5 / ratio, 1.7 / ratio);

    auto deviation = [] (std::pair<double, double> a, std::pair<double, double> b)
    { return std::max (std::abs (a.first / b.first - 1.0), std::abs (a.second / b.second - 1.0)); };

    check (deviation (fOut, fIn) < 0.12 && deviation (fNaive, fIn) > 0.15, "Formants stay put when shifting -5 semitones",
           "F1/F2 input " + juce::String (fIn.first, 0) + "/" + juce::String (fIn.second, 0) + " Hz, SnapTune "
               + juce::String (fOut.first, 0) + "/" + juce::String (fOut.second, 0) + " Hz, naive resample "
               + juce::String (fNaive.first, 0) + "/" + juce::String (fNaive.second, 0) + " Hz");

    if (outDir.isDirectory())
    {
        writeWav (outDir.getChildFile ("formant_input_A3.wav"), input, sampleRate);
        writeWav (outDir.getChildFile ("formant_snaptune_E3.wav"), output, sampleRate);
        writeWav (outDir.getChildFile ("formant_naive_resample_E3.wav"), resampled, sampleRate);

        auto melody = renderVoice (sampleRate, 5.7, melodyPitch (offKeyMelody));
        auto shifted = hardTune();
        shifted.formantSemitones = 4.0f;
        writeWav (outDir.getChildFile ("melody_hardtune_formant_plus4.wav"), runEngine (melody, sampleRate, shifted), sampleRate);
        shifted.formantSemitones = -4.0f;
        writeWav (outDir.getChildFile ("melody_hardtune_formant_minus4.wav"), runEngine (melody, sampleRate, shifted), sampleRate);
    }
}

void testTransparency()
{
    const double sampleRate = 48000.0;

    std::mt19937 rng (99);
    std::normal_distribution<float> gauss (0.0f, 0.1f);
    std::vector<float> noise ((size_t) (3.0 * sampleRate));

    for (auto& x : noise)
        x = gauss (rng);

    const auto noiseOut = runEngine (noise, sampleRate, hardTune());
    const double noiseSnr = snrDb (noise, noiseOut, (size_t) sampleRate / 10, noise.size() - (size_t) sampleRate / 10);
    check (noiseSnr > 60.0, "Unpitched audio passes through untouched", "SNR " + juce::String (noiseSnr, 1) + " dB vs delayed input");

    const auto voice = renderVoice (sampleRate, 5.7, melodyPitch (offKeyMelody));
    auto settings = hardTune();
    settings.amount = 0.0f;
    const auto voiceOut = runEngine (voice, sampleRate, settings);
    const double voiceSnr = snrDb (voice, voiceOut, 0, voice.size());
    check (voiceSnr > 25.0, "Amount 0% reproduces the voice", "SNR " + juce::String (voiceSnr, 1) + " dB vs delayed input");

    std::vector<float> silence ((size_t) sampleRate, 0.0f);
    const auto silenceOut = runEngine (silence, sampleRate, hardTune());
    const bool allZero = std::all_of (silenceOut.begin(), silenceOut.end(), [] (float x) { return x == 0.0f; });
    check (allZero, "Silence in, silence out", allZero ? "exact zeros" : "non-zero output");
}

// Mean YIN aperiodicity over the steady part of each note: splice clicks or grain jitter raise it.
double steadyAperiodicity (const std::vector<float>& x, double sampleRate, const std::vector<SungNote>& notes)
{
    std::vector<double> values;
    const auto track = trackPitch (x, sampleRate);

    for (const auto& n : notes)
        for (const auto& p : track)
            if (p.time >= n.start + 0.2 && p.time <= n.end - 0.1)
                values.push_back (p.aperiodicity);

    return mean (values);
}

std::vector<SungNote> transposed (std::vector<SungNote> notes, double semitones)
{
    for (auto& n : notes)
        n.note += semitones;

    return notes;
}

void testLiveMode (const juce::File& outDir)
{
    const double sampleRate = 48000.0;
    auto live = hardTune();
    live.mode = LatencyMode::live;

    AutoTuneEngine probe;
    probe.setSettings (live);
    probe.prepare (sampleRate, 1);
    const int latency = probe.getLatencySamples();

    const auto input = renderVoice (sampleRate, 5.7, melodyPitch (offKeyMelody));
    const auto output = runEngine (input, sampleRate, live);
    const auto track = trackPitch (output, sampleRate);
    std::vector<double> errors;

    for (const auto& n : offKeyMelody)
        for (auto e : centsInRange (track, n.start + 0.2, n.end - 0.1, n.note))
            errors.push_back (std::abs (e));

    check (latency < 0.004 * sampleRate && percentile (errors, 0.5) < 3.0 && percentile (errors, 0.95) < 15.0,
           "Live mode: hard tune with low latency",
           "latency " + juce::String (latency) + " samples (" + juce::String (1000.0 * latency / sampleRate, 2) + " ms), median "
               + juce::String (percentile (errors, 0.5), 2) + " ct, p95 " + juce::String (percentile (errors, 0.95), 2) + " ct");

    const double apIn = steadyAperiodicity (input, sampleRate, offKeyMelody);
    const double apStudio = steadyAperiodicity (runEngine (input, sampleRate, hardTune()), sampleRate, offKeyMelody);
    const double apLive = steadyAperiodicity (output, sampleRate, offKeyMelody);
    check (apLive < 0.03 && apStudio < 0.03, "Splices / grains stay clean (periodicity)",
           "mean aperiodicity input " + juce::String (apIn, 4) + ", Studio " + juce::String (apStudio, 4) + ", Live " + juce::String (apLive, 4));

    std::mt19937 rng (7);
    std::normal_distribution<float> gauss (0.0f, 0.1f);
    std::vector<float> noise ((size_t) (2.0 * sampleRate));

    for (auto& x : noise)
        x = gauss (rng);

    const double noiseSnr = snrDb (noise, runEngine (noise, sampleRate, live), 0, noise.size());
    auto untouched = live;
    untouched.amount = 0.0f;
    const double voiceSnr = snrDb (input, runEngine (input, sampleRate, untouched), 0, input.size());
    check (noiseSnr > 60.0 && voiceSnr > 60.0, "Live mode passes audio through exactly when nothing needs fixing",
           "noise SNR " + juce::String (noiseSnr, 1) + " dB, voice at Amount 0% SNR " + juce::String (voiceSnr, 1) + " dB");

    if (outDir.isDirectory())
        writeWav (outDir.getChildFile ("melody_hardtune_live.wav"), output, sampleRate);
}

void testLowVoice()
{
    // Same melody an octave and a bit lower (D2-B2, 73-123 Hz): the longest periods the plugin
    // handles, where both modes have the least headroom.
    const double sampleRate = 48000.0;
    const auto notes = transposed (offKeyMelody, -15.0);
    const auto input = renderVoice (sampleRate, 5.7, melodyPitch (notes));

    for (auto mode : { LatencyMode::studio, LatencyMode::live })
    {
        auto settings = hardTune();
        settings.voice = VoiceType::lowMale;
        settings.mode = mode;
        const auto output = runEngine (input, sampleRate, settings);
        const auto track = trackPitch (output, sampleRate);
        std::vector<double> errors;

        for (const auto& n : notes)
            for (auto e : centsInRange (track, n.start + 0.2, n.end - 0.1, n.note))
                errors.push_back (std::abs (e));

        const double aperiodicity = steadyAperiodicity (output, sampleRate, notes);
        check (percentile (errors, 0.5) < 3.0 && aperiodicity < 0.03, juce::String ("Low male voice (73-123 Hz), ") + (mode == LatencyMode::live ? "Live" : "Studio"),
               "median " + juce::String (percentile (errors, 0.5), 2) + " ct, p95 " + juce::String (percentile (errors, 0.95), 2)
                   + " ct, aperiodicity " + juce::String (aperiodicity, 4));
    }
}

void testLiveNoteOnsets()
{
    // Detached notes: as each one starts, the detector hears the old and the new pitch at once and
    // reports unvoiced for a few ms. A splice back to the reported latency right there plays the
    // first cycles of the note twice, so the attack rises, dips and rises again (a "bop"). Either
    // defence alone keeps the onsets clean: no drift-back while a note may be starting, and a
    // drift-back fade no longer than the delay.
    const double sampleRate = 48000.0;
    const std::pair<double, double> pitches[] = { { 57, 30 }, { 60, -25 }, { 64, 20 }, { 55, -40 }, { 62, 15 } };
    std::vector<SungNote> notes;

    for (int i = 0; i < 10; ++i)
    {
        const double start = 0.1 + 0.34 * i;
        notes.push_back ({ start, start + 0.22, pitches[i % 5].first, pitches[i % 5].second });
    }

    auto live = hardTune();
    live.mode = LatencyMode::live;
    const auto input = renderVoice (sampleRate, 3.6, melodyPitch (notes));
    const auto output = runEngine (input, sampleRate, live);

    // Largest drop of the one-period RMS envelope below its running peak while each note starts.
    auto worstAttackDip = [&] (const std::vector<float>& x)
    {
        double worst = 0.0;

        for (const auto& n : notes)
        {
            const auto period = (int) std::lround (sampleRate / midiToHz (n.note + n.cents / 100.0));
            std::vector<double> envelope;

            for (auto centre = (int) ((n.start - 0.005) * sampleRate); centre < (int) ((n.start + 0.05) * sampleRate); centre += 24)
            {
                double energy = 0.0;

                for (int j = centre - period / 2; j < centre + period / 2; ++j)
                    energy += (double) x[(size_t) j] * x[(size_t) j];

                envelope.push_back (10.0 * std::log10 (energy / period + 1.0e-12));
            }

            const double top = *std::max_element (envelope.begin(), envelope.end());
            double peak = -1.0e9;

            for (auto level : envelope)
            {
                if (level < top - 30.0)
                    continue; // still silent

                peak = std::max (peak, level);
                worst = std::max (worst, peak - level);
            }
        }

        return worst;
    };

    const double dipIn = worstAttackDip (input), dipOut = worstAttackDip (output);
    check (dipOut < 1.0, "Live mode: detached notes start cleanly",
           "worst dip in an attack: input " + juce::String (dipIn, 2) + " dB, Live " + juce::String (dipOut, 2) + " dB");
}

// A less polite singer: breath noise, jitter (period wobble), shimmer (level wobble), a room,
// background hiss and a real-world input level. Real mics give the detector all of these.
struct Realism
{
    double peakDb = -6.0;     // input level
    double breath = 0.0;      // aspiration noise relative to the voiced source
    double jitter = 0.0;      // period wobble, fraction
    double shimmer = 0.0;     // amplitude wobble, fraction
    double room = 0.0;        // reverb wet level
    double hissDb = -140.0;   // background noise level
};

std::vector<float> renderRealisticVoice (double sampleRate, double seconds, const std::function<double (double)>& f0, const Realism& r, uint32_t seed = 11)
{
    const auto n = (size_t) (seconds * sampleRate);
    std::vector<float> out (n);
    std::vector<Resonator> tract;

    for (int i = 0; i < 4; ++i)
        tract.emplace_back (vowelA.frequency[i], vowelA.bandwidth[i], sampleRate);

    std::mt19937 rng (seed);
    std::normal_distribution<double> noise (0.0, 1.0);
    double phase = 0.0, envelope = 0.0, lastFrequency = 120.0, wobbleF = 0.0, wobbleA = 0.0;
    const double attack = 1.0 - std::exp (-1.0 / (0.012 * sampleRate));
    const double release = 1.0 - std::exp (-1.0 / (0.02 * sampleRate));
    const double slow = 1.0 - std::exp (-juce::MathConstants<double>::twoPi * 40.0 / sampleRate);

    for (size_t i = 0; i < n; ++i)
    {
        const double t = (double) i / sampleRate;
        const double f = f0 (t);
        const double target = f > 0.0 ? 1.0 : 0.0;
        envelope += (target - envelope) * (target > envelope ? attack : release);

        if (f > 0.0)
            lastFrequency = f;

        // Low-passed noise drives jitter and shimmer.
        wobbleF += slow * (noise (rng) * 3.0 - wobbleF);
        wobbleA += slow * (noise (rng) * 3.0 - wobbleA);

        double source = 0.0;

        if (envelope > 1.0e-5)
        {
            const double frequency = lastFrequency * (1.0 + r.jitter * wobbleF);
            phase += frequency / sampleRate;
            phase -= std::floor (phase);
            const int harmonics = std::min (60, (int) (0.45 * sampleRate / frequency));

            for (int k = 1; k <= harmonics; ++k)
                source += std::sin (juce::MathConstants<double>::twoPi * k * phase) / k;

            source = envelope * ((1.0 + r.shimmer * wobbleA) * source + r.breath * 2.0 * noise (rng));
        }

        double y = source;

        for (auto& res : tract)
            y = res.process (y);

        out[i] = (float) y;
    }

    // Small room: four damped combs and two allpasses (Schroeder style).
    if (r.room > 0.0)
    {
        const int combDelays[] = { 1557, 1617, 1491, 1422 };
        const int allpassDelays[] = { 556, 225 };
        std::vector<std::vector<float>> combs, allpasses;
        std::vector<size_t> combPos (4, 0), allpassPos (2, 0);
        std::vector<float> combDamp (4, 0.0f);

        for (int d : combDelays)
            combs.emplace_back ((size_t) (d * sampleRate / 44100.0), 0.0f);

        for (int d : allpassDelays)
            allpasses.emplace_back ((size_t) (d * sampleRate / 44100.0), 0.0f);

        for (auto& x : out)
        {
            float wet = 0.0f;

            for (size_t c = 0; c < 4; ++c)
            {
                auto& line = combs[c];
                const float delayed = line[combPos[c]];
                combDamp[c] = delayed * 0.75f + combDamp[c] * 0.25f;
                line[combPos[c]] = x * 0.015f + combDamp[c] * 0.84f;
                combPos[c] = (combPos[c] + 1) % line.size();
                wet += delayed;
            }

            for (size_t a = 0; a < 2; ++a)
            {
                auto& line = allpasses[a];
                const float delayed = line[allpassPos[a]];
                line[allpassPos[a]] = wet + delayed * 0.5f;
                allpassPos[a] = (allpassPos[a] + 1) % line.size();
                wet = delayed - wet;
            }

            x = x + (float) r.room * wet * 8.0f;
        }
    }

    float peak = 1.0e-9f;

    for (auto x : out)
        peak = std::max (peak, std::abs (x));

    const auto gain = (float) (juce::Decibels::decibelsToGain (r.peakDb) / peak);
    const auto hiss = juce::Decibels::decibelsToGain (r.hissDb);

    for (auto& x : out)
        x = x * gain + (float) (hiss * noise (rng));

    return out;
}

/** Fraction of analysis hops inside the sung notes (onsets and ends trimmed) that the engine
    treated as pitched. Dropouts here are what break the correction (and the graph) on real voices. */
double voicedCoverage (const std::vector<PitchFrame>& frames, double sampleRate, const std::vector<SungNote>& notes)
{
    const double maxPeriod = std::ceil (sampleRate / 65.0);
    const double hop = std::max (32.0, (double) std::lround (sampleRate / 375.0));
    const double firstHop = std::ceil ((2.0 * maxPeriod + 2.0) / hop) * hop;
    int inside = 0, voiced = 0;

    for (size_t i = 0; i < frames.size(); ++i)
    {
        const double t = (firstHop + (double) i * hop - 0.75 * maxPeriod - hop) / sampleRate;

        for (const auto& n : notes)
        {
            if (t >= n.start + 0.08 && t <= n.end - 0.08)
            {
                ++inside;
                voiced += frames[i].voiced ? 1 : 0;
            }
        }
    }

    return inside > 0 ? (double) voiced / inside : 0.0;
}

void testRealWorldVoices()
{
    const double sampleRate = 48000.0;
    const auto low = transposed (offKeyMelody, -12.0); // A2-D3, like a low male singer

    struct Case
    {
        const char* name;
        Realism realism;
        bool lowVoice;
    };

    const Case cases[] = {
        { "clean, loud", {}, false },
        { "quiet input (-40 dBFS peak)", { -40.0 }, false },
        { "very quiet input (-52 dBFS peak)", { -52.0 }, false },
        { "breathy + jitter + shimmer", { -12.0, 0.35, 0.012, 0.15 }, false },
        { "room reverb + hiss", { -12.0, 0.1, 0.006, 0.08, 0.5, -62.0 }, false },
        { "low male, everything, quiet", { -38.0, 0.3, 0.012, 0.15, 0.45, -66.0 }, true },
    };

    for (const auto& c : cases)
    {
        const auto& notes = c.lowVoice ? low : offKeyMelody;
        const auto input = renderRealisticVoice (sampleRate, 5.7, melodyPitch (notes), c.realism);

        for (auto mode : { LatencyMode::studio, LatencyMode::live })
        {
            auto settings = hardTune();
            settings.mode = mode;
            settings.voice = c.lowVoice ? VoiceType::lowMale : VoiceType::altoTenor;
            std::vector<PitchFrame> frames;
            runEngine (input, sampleRate, settings, {}, 256, nullptr, &frames);
            const double coverage = voicedCoverage (frames, sampleRate, notes);
            check (coverage > 0.95, juce::String ("Tracks a real-world voice: ") + c.name + (mode == LatencyMode::live ? " [Live]" : " [Studio]"),
                   "pitched " + juce::String (100.0 * coverage, 1) + "% of the time while singing");
        }
    }
}

/** Fraction of the hops inside the notes (onsets trimmed) where the engine's detected pitch is
    within a semitone of the sung one. Octave and sub-harmonic picks are what this catches. */
double pitchAccuracy (const std::vector<PitchFrame>& frames, double sampleRate, const std::vector<SungNote>& notes)
{
    const double maxPeriod = std::ceil (sampleRate / 65.0);
    const double hop = std::max (32.0, (double) std::lround (sampleRate / 375.0));
    const double firstHop = std::ceil ((2.0 * maxPeriod + 2.0) / hop) * hop;
    int inside = 0, right = 0;

    for (size_t i = 0; i < frames.size(); ++i)
    {
        const double t = (firstHop + (double) i * hop - 0.75 * maxPeriod - hop) / sampleRate;

        for (const auto& n : notes)
        {
            if (t >= n.start + 0.08 && t <= n.end - 0.02)
            {
                ++inside;
                right += frames[i].voiced && std::abs (frames[i].inputNote - (n.note + n.cents / 100.0)) < 1.0 ? 1 : 0;
            }
        }
    }

    return inside > 0 ? (double) right / inside : 0.0;
}

/** Changes of the target note between consecutive voiced hops inside the notes (onsets and ends trimmed). */
int targetFlips (const std::vector<PitchFrame>& frames, double sampleRate, const std::vector<SungNote>& notes)
{
    const double maxPeriod = std::ceil (sampleRate / 65.0);
    const double hop = std::max (32.0, (double) std::lround (sampleRate / 375.0));
    const double firstHop = std::ceil ((2.0 * maxPeriod + 2.0) / hop) * hop;
    int flips = 0;

    for (size_t i = 1; i < frames.size(); ++i)
    {
        const double t = (firstHop + (double) i * hop - 0.75 * maxPeriod - hop) / sampleRate;

        for (const auto& n : notes)
            if (t >= n.start + 0.08 && t <= n.end - 0.08 && frames[i - 1].voiced && frames[i].voiced && frames[i - 1].targetNote != frames[i].targetNote)
                ++flips;
    }

    return flips;
}

void testNoteFlips()
{
    // A breathy note held 35 cents sharp, about 20 cents from where hard tune switches to the
    // next note. Estimation noise used to flip the target there for a few ms at a time, about 15
    // times a second in Live (85 target changes in 2.6 s): each excursion is a semitone bop at hard
    // tune. The Live window, the scaled extrapolation and the smoothed note choice keep it still.
    const double sampleRate = 48000.0;
    const std::vector<SungNote> held { { 0.10, 2.90, 57, +35 } };

    for (auto mode : { LatencyMode::studio, LatencyMode::live })
    {
        auto settings = hardTune();
        settings.mode = mode;
        int flips = 0;

        // The breath noise differs between standard libraries, so count over three realisations:
        // a few flips each (up to ~12), against 85 in the old Live engine and ~14 without the
        // smoothed note choice.
        for (uint32_t seed : { 11u, 12u, 13u })
        {
            const auto input = renderRealisticVoice (sampleRate, 3.0, melodyPitch (held), { -12.0, 0.35, 0.012, 0.15 }, seed);
            std::vector<PitchFrame> frames;
            runEngine (input, sampleRate, settings, {}, 256, nullptr, &frames);
            flips += targetFlips (frames, sampleRate, held);
        }

        check (flips <= 24, juce::String ("Breathy held note keeps its target") + (mode == LatencyMode::live ? " [Live]" : " [Studio]"),
               juce::String (flips) + " note flips in 3 x 2.6 s");
    }
}

void testDropoutResume()
{
    // A held note 35 cents sharp with a 15 ms burst of noise in the middle (a breath or a consonant
    // inside the note), at a 60 ms retune. The detector loses the pitch there; the note must come
    // back on its correction, not glide onto the target again from uncorrected. (The tracker's frames
    // overlap the burst for ~25 ms after it, so the check starts there.)
    const double sampleRate = 48000.0;
    const std::vector<SungNote> held { { 0.10, 1.40, 57, +35 } };
    auto input = renderVoice (sampleRate, 1.5, melodyPitch (held));
    const auto burstStart = (size_t) (0.80 * sampleRate), burstEnd = (size_t) (0.815 * sampleRate);
    double power = 0.0;

    for (size_t i = burstStart; i < burstEnd; ++i)
        power += (double) input[i] * input[i];

    std::mt19937 rng (7);
    std::normal_distribution<double> noise (0.0, std::sqrt (power / (double) (burstEnd - burstStart)));

    for (size_t i = burstStart; i < burstEnd; ++i)
        input[i] = (float) noise (rng);

    for (auto mode : { LatencyMode::studio, LatencyMode::live })
    {
        auto settings = hardTune();
        settings.mode = mode;
        settings.retuneMs = 60.0f;
        const auto output = runEngine (input, sampleRate, settings);
        double worst = 0.0;

        for (const auto& p : trackPitch (output, sampleRate))
            if (p.time > 0.843 && p.time < 0.88)
                worst = std::max (worst, std::abs (100.0 * (hzToMidi (p.hz) - 57.0)));

        // Restarting from uncorrected leaves 9-11 cents here.
        check (worst < 5.0, juce::String ("A dropout inside a note doesn't restart its correction") + (mode == LatencyMode::live ? " [Live]" : " [Studio]"),
               "worst error 28-65 ms after it " + juce::String (worst, 1) + " ct");
    }
}

void testOctaveErrors()
{
    const double sampleRate = 48000.0;

    // Legato octave leaps both ways: the detector must follow them, not hold the old octave.
    const std::vector<SungNote> leaps { { 0.10, 0.80, 57, 0 }, { 0.80, 1.50, 69, 0 }, { 1.50, 2.20, 57, 0 }, { 2.20, 2.90, 45, 0 }, { 2.90, 3.60, 57, 0 } };
    const auto leapInput = renderVoice (sampleRate, 3.7, melodyPitch (leaps));

    // A held note with breath, jitter and room sound: consecutive cycles differ enough that YIN
    // without a guard often prefers 2-4 periods (the note reads an octave or more too low). Then the
    // same voice over bleed a fifth below, 14 dB down (speaker spill, a backing vocal), which
    // repeats every two voice periods.
    const std::vector<SungNote> held { { 0.10, 2.90, 63, 0 } };
    const auto roomy = renderRealisticVoice (sampleRate, 3.0, melodyPitch (held), { -12.0, 0.35, 0.012, 0.15, 0.3 });
    const auto bleed = renderVoice (sampleRate, 3.0, [] (double t) { return t >= 0.05 && t < 2.95 ? midiToHz (63.0) * 2.0 / 3.0 : 0.0; });
    auto withBleed = roomy;

    for (size_t i = 0; i < withBleed.size(); ++i)
        withBleed[i] += 0.1f * bleed[i];

    for (auto mode : { LatencyMode::studio, LatencyMode::live })
    {
        const juce::String tag (mode == LatencyMode::live ? " [Live]" : " [Studio]");
        auto settings = hardTune();
        settings.mode = mode;

        auto score = [&] (const std::vector<float>& input, const std::vector<SungNote>& notes)
        {
            std::vector<PitchFrame> frames;
            runEngine (input, sampleRate, settings, {}, 256, nullptr, &frames);
            return pitchAccuracy (frames, sampleRate, notes);
        };

        const double leapScore = score (leapInput, leaps);
        const double roomyScore = score (roomy, held);
        const double bleedScore = score (withBleed, held);
        check (leapScore > 0.97, "Follows octave leaps" + tag, "right octave " + juce::String (100.0 * leapScore, 1) + "% of the time");
        // Live integrates over ~1.5 periods, so it is noisier. The breath noise also differs between
        // standard libraries (libstdc++ vs libc++), so leave room. The old detector scores 53-56 % on
        // the roomy voice and 27-28 % with bleed.
        const double minimum = mode == LatencyMode::live ? 0.9 : 0.95;
        check (roomyScore > minimum, "No sub-harmonic jumps on a roomy, breathy voice" + tag, "right octave " + juce::String (100.0 * roomyScore, 1) + "% of the time");
        check (bleedScore > minimum - 0.05, "No sub-harmonic jumps with bleed a fifth below" + tag, "right octave " + juce::String (100.0 * bleedScore, 1) + "% of the time");
    }
}

const Vowel vowelU { { 300.0, 870.0, 2240.0, 3300.0 }, { 60.0, 90.0, 120.0, 150.0 } };

/** Like renderVoice, for one held note while the formants glide from one vowel to another. */
std::vector<float> renderVowelGlide (double sampleRate, double seconds, double hz, const Vowel& from, const Vowel& to, double glideStart, double glideEnd)
{
    const auto n = (size_t) (seconds * sampleRate);
    std::vector<float> out (n);
    std::vector<Resonator> tract;

    for (int i = 0; i < 4; ++i)
        tract.emplace_back (from.frequency[i], from.bandwidth[i], sampleRate);

    std::mt19937 rng (1234);
    std::normal_distribution<double> noise (0.0, 1.0);
    double phase = 0.0, envelope = 0.0;
    const double attack = 1.0 - std::exp (-1.0 / (0.012 * sampleRate));
    const double release = 1.0 - std::exp (-1.0 / (0.02 * sampleRate));
    const int harmonics = std::min (60, (int) (0.45 * sampleRate / hz));

    for (size_t i = 0; i < n; ++i)
    {
        const double t = (double) i / sampleRate;
        const double target = t >= 0.1 && t < seconds - 0.1 ? 1.0 : 0.0;
        envelope += (target - envelope) * (target > envelope ? attack : release);

        if (i % 16 == 0)
        {
            const double x = std::clamp ((t - glideStart) / (glideEnd - glideStart), 0.0, 1.0);

            for (size_t k = 0; k < tract.size(); ++k)
            {
                Resonator updated (from.frequency[k] + x * (to.frequency[k] - from.frequency[k]),
                                   from.bandwidth[k] + x * (to.bandwidth[k] - from.bandwidth[k]), sampleRate);
                updated.y1 = tract[k].y1;
                updated.y2 = tract[k].y2;
                tract[k] = updated;
            }
        }

        double source = 0.0;

        if (envelope > 1.0e-5)
        {
            phase += hz / sampleRate;
            phase -= std::floor (phase);

            for (int k = 1; k <= harmonics; ++k)
                source += std::sin (juce::MathConstants<double>::twoPi * k * phase) / k;

            source = envelope * (source + 0.004 * noise (rng));
        }

        double y = source;

        for (auto& r : tract)
            y = r.process (y);

        out[i] = (float) y;
    }

    float peak = 1.0e-9f;

    for (auto x : out)
        peak = std::max (peak, std::abs (x));

    for (auto& x : out)
        x *= 0.5f / peak;

    return out;
}

void testOctaveSlips()
{
    // A held A3 (30 cents sharp) while the vowel glides from /u/ to /a/: as F1 sweeps past the
    // second harmonic, that harmonic dominates and the detector reads the note an octave up for a
    // few hops. The correction is the same in either octave, but pitch marks that follow the slip
    // land half a period apart and cut every cycle in two (the independent tracker loses the pitch).
    // The octave guard usually holds the period first; the marks' harmonic check backs it up.
    const double sampleRate = 48000.0;
    const auto input = renderVowelGlide (sampleRate, 1.4, midiToHz (57.3), vowelU, vowelA, 0.4, 0.9);
    const auto output = runEngine (input, sampleRate, hardTune());

    double gap = 0.0, worst = 0.0, previous = 0.3;
    std::vector<double> errors;

    for (const auto& p : trackPitch (output, sampleRate))
    {
        if (p.time < 0.3 || p.time > 1.2)
            continue;

        gap = std::max (gap, p.time - previous);
        previous = p.time;
        worst = std::max (worst, p.aperiodicity);
        errors.push_back (std::abs (100.0 * (hzToMidi (p.hz) - 57.0)));
    }

    gap = std::max (gap, 1.2 - previous);
    check (gap < 0.012 && worst < 0.05 && percentile (errors, 1.0) < 10.0, "Vowel change: a brief octave slip leaves grains whole",
           "longest unpitched stretch " + juce::String (juce::roundToInt (1000.0 * gap)) + " ms, worst aperiodicity " + juce::String (worst, 4)
               + ", max error " + juce::String (percentile (errors, 1.0), 2) + " ct");
}

void testLeapsOntoFormant()
{
    // Instant legato octave leaps on /u/: its first formant (300 Hz) sits on the low note's second
    // harmonic, so after each leap down the old period still dips fairly well and the octave guard
    // may hold the upper octave for a few hops. It must let go: a guard that keeps holding against a
    // clean pick loses whole notes. (pitchAccuracy skips each note's first 80 ms, so a short hold
    // isn't measured here.)
    const double sampleRate = 48000.0;
    std::vector<SungNote> leaps;

    for (int i = 0; i < 8; ++i)
        leaps.push_back ({ 0.10 + 0.4 * i, 0.50 + 0.4 * i, i % 2 == 0 ? 62.0 : 50.0, 20.0 });

    const auto input = renderVoice (sampleRate, 3.4, melodyPitch (leaps), vowelU);

    for (auto mode : { LatencyMode::studio, LatencyMode::live })
    {
        auto settings = hardTune();
        settings.mode = mode;
        std::vector<PitchFrame> frames;
        runEngine (input, sampleRate, settings, {}, 256, nullptr, &frames);
        const double accuracy = pitchAccuracy (frames, sampleRate, leaps);
        check (accuracy > 0.97, juce::String ("Follows octave leaps onto /u/") + (mode == LatencyMode::live ? " [Live]" : " [Studio]"),
               "right octave " + juce::String (100.0 * accuracy, 1) + "% of the time");
    }
}

void testFastLeapUp()
{
    // A sudden leap up of 16 semitones (the periods are 2.5x apart, not a whole ratio), sung off so
    // that C major moves the upper note 70 cents. The pitch marks' harmonic check could take the new
    // note for the old period and space the rest of its grains several cycles apart: a growl. Taking
    // the measured spacing as the marks' period, and the 30 ms limit on wider spacing, each prevent it.
    const double sampleRate = 48000.0;
    const std::vector<SungNote> notes { { 0.10, 0.70, 50, +30 }, { 0.70, 1.30, 66, -30 }, { 1.30, 1.90, 50, +25 } };
    const auto input = renderVoice (sampleRate, 2.0, melodyPitch (notes));
    auto settings = hardTune();
    settings.scale = Scale::major;
    const auto output = runEngine (input, sampleRate, settings);

    std::vector<double> aperiodicity;

    for (const auto& p : trackPitch (output, sampleRate))
        if (p.time > 0.8 && p.time < 1.25)
            aperiodicity.push_back (p.aperiodicity);

    const double worst = aperiodicity.empty() ? 1.0 : percentile (aperiodicity, 0.95);
    check (worst < 0.01, "Fast leap up keeps whole grains [Studio]", "upper note aperiodicity p95 " + juce::String (worst, 4));
}

void testModeSwitch()
{
    const double sampleRate = 48000.0;
    const auto input = renderVoice (sampleRate, 5.7, melodyPitch (offKeyMelody));
    AutoTuneEngine engine;
    auto settings = hardTune();
    engine.setSettings (settings);
    engine.prepare (sampleRate, 1);
    const int studioLatency = engine.getLatencySamples();

    std::vector<float> buffer = input;
    bool finite = true;
    int liveLatency = 0;

    for (size_t pos = 0; pos < buffer.size(); pos += 256)
    {
        // Flip modes a few times mid-note.
        const auto t = (double) pos / sampleRate;
        settings.mode = (t > 1.5 && t < 3.0) || t > 4.8 ? LatencyMode::live : LatencyMode::studio;
        engine.setSettings (settings);
        float* channel = buffer.data() + pos;
        engine.process (&channel, 1, 0, (int) std::min<size_t> (256, buffer.size() - pos));

        if (settings.mode == LatencyMode::live)
            liveLatency = engine.getLatencySamples();

        for (size_t i = pos; i < std::min (pos + 256, buffer.size()); ++i)
            finite = finite && std::isfinite (buffer[i]) && std::abs (buffer[i]) < 2.0f;
    }

    check (finite && liveLatency > 0 && liveLatency < studioLatency, "Switching Studio <-> Live mid-stream",
           juce::String ("output finite and bounded: ") + (finite ? "yes" : "no") + ", latency " + juce::String (studioLatency) + " -> "
               + juce::String (liveLatency) + " samples");
}

void testGraphStaysStill()
{
    PitchGraph graph;
    graph.setSize (640, 330);
    graph.setFramesPerSecond (375.0);
    graph.setHomeNote (57);

    std::vector<PitchFrame> chunk (6);
    int moves = 0;
    float lastLow = graph.getNoteRange().getStart();

    // Sing for `seconds` around `note` (with vibrato), 60 UI updates per second, counting range changes.
    auto sing = [&] (double seconds, float note)
    {
        for (int tick = 0; tick < (int) (seconds * 60.0); ++tick)
        {
            for (auto& f : chunk)
            {
                f.voiced = true;
                f.inputNote = note + 0.25f * std::sin ((float) tick * 0.6f);
                f.outputNote = std::round (note);
                f.targetNote = (int) std::round (note);
            }

            graph.pushFrames (chunk.data(), (int) chunk.size());

            if (std::abs (graph.getNoteRange().getStart() - lastLow) > 0.01f)
            {
                ++moves;
                lastLow = graph.getNoteRange().getStart();
            }
        }
    };

    const auto home = graph.getNoteRange();
    sing (1.0, 55.0f);
    sing (1.0, 60.0f);
    sing (1.0, 52.0f);
    const bool stillInRange = moves == 0;

    sing (1.0, 72.0f); // leaves the window: should move once, to put C5 on screen
    const auto followed = graph.getNoteRange();
    const int movesToFollow = moves;
    sing (1.0, 70.0f);
    sing (1.0, 74.0f);

    check (stillInRange && followed.contains (72.0f) && moves == movesToFollow, "Pitch graph keeps its note range still",
           "home " + juce::String (home.getStart() + 0.5f, 0) + "-" + juce::String (home.getEnd() - 0.5f, 0) + ": no movement for notes on screen, "
               + "moved only when the voice left it (now " + juce::String (followed.getStart() + 0.5f, 0) + "-" + juce::String (followed.getEnd() - 0.5f, 0) + ")");
}

void testBlockSizesAndCpu()
{
    const double sampleRate = 48000.0;
    const auto input = renderVoice (sampleRate, 5.7, melodyPitch (offKeyMelody));
    bool identical = true;

    for (auto mode : { LatencyMode::studio, LatencyMode::live })
    {
        auto settings = hardTune();
        settings.mode = mode;
        const auto reference = runEngine (input, sampleRate, settings, {}, 512);

        for (int block : { 1, 17, 64, 1000, 4096 })
            identical = identical && runEngine (input, sampleRate, settings, {}, block) == reference;
    }

    check (identical, "Output is independent of host block size", "both modes, blocks 1, 17, 64, 512, 1000, 4096");

    std::vector<float> longInput;

    for (int i = 0; i < 4; ++i)
        longInput.insert (longInput.end(), input.begin(), input.end());

    const double audioSeconds = (double) longInput.size() / sampleRate;
    double studioSeconds = 0.0, liveSeconds = 0.0;
    runEngine (longInput, sampleRate, hardTune(), {}, 256, &studioSeconds);
    auto live = hardTune();
    live.mode = LatencyMode::live;
    runEngine (longInput, sampleRate, live, {}, 256, &liveSeconds);
    check (studioSeconds < audioSeconds * 0.05 && liveSeconds < audioSeconds * 0.05, "CPU load (mono, % of one core)",
           "Studio " + juce::String (100.0 * studioSeconds / audioSeconds, 2) + "%, Live " + juce::String (100.0 * liveSeconds / audioSeconds, 2) + "%");
}

void testProcessorStereoAndState()
{
    const double sampleRate = 44100.0;
    SnapTuneProcessor processor;
    processor.setPlayConfigDetails (2, 2, sampleRate, 512);
    processor.prepareToPlay (sampleRate, 512);

    auto setPlain = [&] (const char* id, float value)
    {
        auto* p = processor.apvts.getParameter (id);
        p->setValueNotifyingHost (p->convertTo0to1 (value));
    };

    setPlain (ids::retune, 0.0f);
    setPlain (ids::scale, (float) Scale::major);
    setPlain (ids::key, 7.0f); // G major

    juce::MemoryBlock state;
    processor.getStateInformation (state);
    setPlain (ids::key, 2.0f);
    processor.setStateInformation (state.getData(), (int) state.getSize());
    const bool restored = (int) processor.apvts.getRawParameterValue (ids::key)->load() == 7
                          && processor.apvts.getRawParameterValue (ids::retune)->load() < 0.01f;
    check (restored, "Plugin state save / restore", restored ? "key and retune restored" : "mismatch");

    const auto voice = renderVoice (sampleRate, 5.7, melodyPitch (offKeyMelody));
    const int latency = processor.getLatencySamples();
    juce::AudioBuffer<float> buffer (2, 512);
    juce::MidiBuffer midi;
    std::vector<float> left, right;

    for (size_t pos = 0; pos < voice.size() + (size_t) latency; pos += 512)
    {
        for (int i = 0; i < 512; ++i)
        {
            const float x = pos + (size_t) i < voice.size() ? voice[pos + (size_t) i] : 0.0f;
            buffer.setSample (0, i, x);
            buffer.setSample (1, i, x);
        }

        processor.processBlock (buffer, midi);

        for (int i = 0; i < 512; ++i)
        {
            left.push_back (buffer.getSample (0, i));
            right.push_back (buffer.getSample (1, i));
        }
    }

    left.erase (left.begin(), left.begin() + latency);
    right.erase (right.begin(), right.begin() + latency);
    const bool sameChannels = left == right;

    // Every note of the melody (A, C, E, G, D) is in G major, so each should land exactly.
    std::vector<double> errors;
    const auto track = trackPitch (left, sampleRate);

    for (const auto& n : offKeyMelody)
        for (auto e : centsInRange (track, n.start + 0.2, n.end - 0.1, n.note))
            errors.push_back (std::abs (e));

    check (sameChannels && percentile (errors, 0.5) < 3.0, "Stereo processor @ 44.1 kHz, G major",
           juce::String ("L == R: ") + (sameChannels ? "yes" : "no") + ", median error " + juce::String (percentile (errors, 0.5), 2)
               + " ct, latency " + juce::String (latency) + " samples (" + juce::String (1000.0 * latency / sampleRate, 1) + " ms)");
}

//==============================================================================
int runProcessFile (const juce::StringArray& args)
{
    const juce::File in (args[2]), out (args[3]);
    juce::AudioFormatManager formats;
    formats.registerBasicFormats();
    std::unique_ptr<juce::AudioFormatReader> reader (formats.createReaderFor (in));

    if (reader == nullptr)
    {
        std::printf ("Could not read %s\n", in.getFullPathName().toRawUTF8());
        return 1;
    }

    juce::AudioBuffer<float> audio ((int) reader->numChannels, (int) reader->lengthInSamples);
    reader->read (&audio, 0, (int) reader->lengthInSamples, 0, true, true);
    std::vector<float> mono ((size_t) audio.getNumSamples(), 0.0f);

    for (int c = 0; c < audio.getNumChannels(); ++c)
        for (int i = 0; i < audio.getNumSamples(); ++i)
            mono[(size_t) i] += audio.getSample (c, i) / (float) audio.getNumChannels();

    EngineSettings settings;
    settings.retuneMs = 0.0f;

    for (int i = 4; i + 1 < args.size(); i += 2)
    {
        if (args[i] == "--key")
            settings.key = juce::jmax (0, juce::StringArray (noteNames.data(), 12).indexOf (args[i + 1]));
        else if (args[i] == "--scale")
            settings.scale = (Scale) juce::jmax (0, juce::StringArray (scaleNames.data(), (int) scaleNames.size()).indexOf (args[i + 1], true));
        else if (args[i] == "--retune")
            settings.retuneMs = args[i + 1].getFloatValue();
        else if (args[i] == "--formant")
            settings.formantSemitones = args[i + 1].getFloatValue();
        else if (args[i] == "--mode")
            settings.mode = args[i + 1] == "live" ? LatencyMode::live : LatencyMode::studio;
        else if (args[i] == "--amount")
            settings.amount = args[i + 1].getFloatValue() * 0.01f;
        else if (args[i] == "--voice")
            settings.voice = (VoiceType) juce::jlimit (0, 3, args[i + 1].getIntValue());
    }

    std::vector<PitchFrame> frames;
    const auto tuned = runEngine (mono, reader->sampleRate, settings, {}, 256, nullptr, &frames);
    writeWav (out, tuned, reader->sampleRate);

    {
        // Engine's own analysis, one row per hop (times approximate the centre of each analysis window).
        const double rate = reader->sampleRate;
        const double maxPeriod = std::ceil (rate / 65.0);
        const double hop = std::max (32.0, (double) std::lround (rate / 375.0));
        const double firstHop = std::ceil ((2.0 * maxPeriod + 2.0) / hop) * hop;
        juce::String csv ("time,voiced,input,output,target\n");

        for (size_t i = 0; i < frames.size(); ++i)
            csv << juce::String ((firstHop + (double) i * hop - (0.75 * maxPeriod + hop)) / rate, 4) << "," << (frames[i].voiced ? 1 : 0) << ","
                << juce::String (frames[i].inputNote, 3) << "," << juce::String (frames[i].outputNote, 3) << "," << frames[i].targetNote << "\n";

        out.withFileExtension ("frames.csv").replaceWithText (csv);
    }

    int voiced = 0;
    std::vector<double> inErr, outErr;
    const auto mask = pitchClassMask (settings.key, settings.scale, settings.customMask);

    for (const auto& p : trackPitch (tuned, reader->sampleRate))
    {
        const double note = hzToMidi (p.hz);
        outErr.push_back (std::abs (note - nearestAllowedNote ((float) note, mask)) * 100.0);
        ++voiced;
    }

    for (const auto& p : trackPitch (mono, reader->sampleRate))
    {
        const double note = hzToMidi (p.hz);
        inErr.push_back (std::abs (note - nearestAllowedNote ((float) note, mask)) * 100.0);
    }

    std::printf ("Wrote %s (%.1f s @ %.0f Hz, %s %s, retune %.0f ms)\n", out.getFullPathName().toRawUTF8(), (double) mono.size() / reader->sampleRate,
                 reader->sampleRate, noteNames[(size_t) settings.key], scaleNames[(size_t) settings.scale], settings.retuneMs);
    std::printf ("Pitched frames: %d. Distance to nearest scale note: input median %.1f ct -> output median %.1f ct\n", voiced,
                 percentile (inErr, 0.5), percentile (outErr, 0.5));
    return 0;
}

int runHostTest (const juce::String& path)
{
    juce::AudioPluginFormatManager manager;
    juce::addDefaultFormatsToManager (manager);

    juce::OwnedArray<juce::PluginDescription> types;

    for (auto* format : manager.getFormats())
        if (format->fileMightContainThisPluginType (path))
            format->findAllTypesForFile (types, path);

    if (types.isEmpty())
    {
        check (false, "Host: load plugin", "no plugin found in " + path);
        return 1;
    }

    const double sampleRate = 48000.0;
    const int block = 480;
    juce::String error;
    auto instance = manager.createPluginInstance (*types[0], sampleRate, block, error);

    if (instance == nullptr)
    {
        check (false, "Host: instantiate " + types[0]->pluginFormatName, error);
        return 1;
    }

    check (true, "Host: instantiate " + types[0]->pluginFormatName,
           types[0]->name + " by " + types[0]->manufacturerName + ", " + juce::String (instance->getParameters().size()) + " parameters, MIDI in: "
               + (instance->acceptsMidi() ? "yes" : "no"));

    instance->enableAllBuses();
    instance->setPlayConfigDetails (2, 2, sampleRate, block);
    instance->prepareToPlay (sampleRate, block);

    for (auto* parameter : instance->getParameters())
        if (parameter->getName (64) == "Retune Speed")
            parameter->setValue (0.0f);

    // An LV2 plugin reports its latency through an output port it writes while it runs, so its host
    // only learns the value after a block; VST3 and AU tell the host straight away. Run a couple of
    // silent blocks, and let messages through, before asking.
    const auto settledLatency = [&]
    {
        juce::AudioBuffer<float> silence (2, block);
        juce::MidiBuffer none;

        for (int i = 0; i < 3; ++i)
        {
            silence.clear();
            instance->processBlock (silence, none);
            juce::MessageManager::getInstance()->runDispatchLoopUntil (50);
        }

        return instance->getLatencySamples();
    };

    const int latency = settledLatency();
    check (latency == 3 * (int) std::ceil (sampleRate / 65.0), "Host: reported latency", juce::String (latency) + " samples");

    const auto voice = renderVoice (sampleRate, 5.7, melodyPitch (offKeyMelody));
    juce::AudioBuffer<float> buffer (2, block);
    juce::MidiBuffer midi;
    std::vector<float> output;

    for (size_t pos = 0; pos < voice.size() + (size_t) latency; pos += (size_t) block)
    {
        for (int i = 0; i < block; ++i)
        {
            const float x = pos + (size_t) i < voice.size() ? voice[pos + (size_t) i] : 0.0f;
            buffer.setSample (0, i, x);
            buffer.setSample (1, i, x);
        }

        instance->processBlock (buffer, midi);

        for (int i = 0; i < block; ++i)
            output.push_back (buffer.getSample (0, i));
    }

    output.erase (output.begin(), output.begin() + latency);
    std::vector<double> errors;
    const auto track = trackPitch (output, sampleRate);

    for (const auto& n : offKeyMelody)
        for (auto e : centsInRange (track, n.start + 0.2, n.end - 0.1, n.note))
            errors.push_back (std::abs (e));

    check (errors.size() > 500 && percentile (errors, 0.5) < 3.0, "Host: plugin binary corrects pitch",
           "median error " + juce::String (percentile (errors, 0.5), 2) + " ct over " + juce::String ((int) errors.size()) + " frames");

    // Flip to Live mode while running, the way a user would: the plugin must announce its new
    // latency to the host on its own (no re-prepare), via the message thread.
    for (auto* parameter : instance->getParameters())
        if (parameter->getName (64) == "Latency Mode")
            parameter->setValue (1.0f);

    instance->processBlock (buffer, midi);
    juce::MessageManager::getInstance()->runDispatchLoopUntil (300);
    const int announced = settledLatency();
    check (announced > 0 && announced < latency / 10, "Host: latency change announced while running",
           juce::String (latency) + " -> " + juce::String (announced) + " samples, no restart needed");

    instance->releaseResources();
    instance->prepareToPlay (sampleRate, block);
    const int liveLatency = settledLatency();
    std::vector<float> liveOutput;

    for (size_t pos = 0; pos < voice.size() + (size_t) liveLatency; pos += (size_t) block)
    {
        for (int i = 0; i < block; ++i)
        {
            const float x = pos + (size_t) i < voice.size() ? voice[pos + (size_t) i] : 0.0f;
            buffer.setSample (0, i, x);
            buffer.setSample (1, i, x);
        }

        instance->processBlock (buffer, midi);

        for (int i = 0; i < block; ++i)
            liveOutput.push_back (buffer.getSample (0, i));
    }

    liveOutput.erase (liveOutput.begin(), liveOutput.begin() + liveLatency);
    std::vector<double> liveErrors;
    const auto liveTrack = trackPitch (liveOutput, sampleRate);

    for (const auto& n : offKeyMelody)
        for (auto e : centsInRange (liveTrack, n.start + 0.2, n.end - 0.1, n.note))
            liveErrors.push_back (std::abs (e));

    check (liveLatency < latency / 10 && percentile (liveErrors, 0.5) < 3.0, "Host: Live mode",
           "latency " + juce::String (liveLatency) + " samples (" + juce::String (1000.0 * liveLatency / sampleRate, 2) + " ms), median error "
               + juce::String (percentile (liveErrors, 0.5), 2) + " ct");

    const bool hasEditor = instance->hasEditor();
    std::unique_ptr<juce::AudioProcessorEditor> editor (hasEditor ? instance->createEditorAndMakeActive() : nullptr);
    check (editor != nullptr, "Host: editor opens", editor != nullptr ? juce::String (editor->getWidth()) + " x " + juce::String (editor->getHeight()) : "none");

    editor.reset();
    instance->releaseResources();
    return failures == 0 ? 0 : 1;
}

int runSnapshot (const juce::File& file, bool liveMode, double uiScale, float pixelScale)
{
    const double sampleRate = 48000.0;
    SnapTuneProcessor processor;
    processor.setPlayConfigDetails (2, 2, sampleRate, 512);
    processor.prepareToPlay (sampleRate, 512);

    auto setPlain = [&] (const char* id, float value)
    {
        auto* p = processor.apvts.getParameter (id);
        p->setValueNotifyingHost (p->convertTo0to1 (value));
    };

    setPlain (ids::scale, (float) Scale::major);
    setPlain (ids::key, 0.0f);
    setPlain (ids::retune, 8.0f);
    setPlain (ids::humanize, 25.0f);
    setPlain (ids::mode, liveMode ? 1.0f : 0.0f);
    processor.apvts.state.setProperty ("uiScale", uiScale, nullptr);

    std::unique_ptr<SnapTuneEditor> editor (dynamic_cast<SnapTuneEditor*> (processor.createEditor()));

    const auto voice = renderVoice (sampleRate, 4.15, melodyPitch (offKeyMelody));
    juce::AudioBuffer<float> buffer (2, 512);
    juce::MidiBuffer midi;
    std::vector<PitchFrame> frames (4096);

    for (size_t pos = 0; pos < voice.size(); pos += 512)
    {
        for (int i = 0; i < 512; ++i)
        {
            const float x = pos + (size_t) i < voice.size() ? voice[pos + (size_t) i] : 0.0f;
            buffer.setSample (0, i, x);
            buffer.setSample (1, i, x);
        }

        processor.processBlock (buffer, midi);
        const int count = processor.engine.popFrames (frames.data(), (int) frames.size());
        editor->injectFrames (frames.data(), count);
    }

    const auto image = editor->createComponentSnapshot (editor->getLocalBounds(), true, pixelScale);
    file.deleteFile();
    juce::FileOutputStream stream (file);
    juce::PNGImageFormat png;
    const bool ok = stream.openedOk() && png.writeImageToStream (image, stream);
    std::printf ("%s %s (%d x %d)\n", ok ? "Wrote" : "Failed to write", file.getFullPathName().toRawUTF8(), image.getWidth(), image.getHeight());
    editor.reset();
    return ok ? 0 : 1;
}
} // namespace

int main (int argc, char* argv[])
{
    juce::ScopedJuceInitialiser_GUI juceInit;
    juce::StringArray args;

    for (int i = 0; i < argc; ++i)
        args.add (juce::String::fromUTF8 (argv[i]));

    if (args[1] == "--process" && args.size() >= 4)
        return runProcessFile (args);

    if (args[1] == "--track" && args.size() >= 4)
    {
        juce::AudioFormatManager formats;
        formats.registerBasicFormats();
        std::unique_ptr<juce::AudioFormatReader> reader (formats.createReaderFor (juce::File (args[2])));

        if (reader == nullptr)
            return 1;

        juce::AudioBuffer<float> audio ((int) reader->numChannels, (int) reader->lengthInSamples);
        reader->read (&audio, 0, (int) reader->lengthInSamples, 0, true, true);
        std::vector<float> mono (audio.getReadPointer (0), audio.getReadPointer (0) + audio.getNumSamples());
        juce::String csv ("time,hz,aperiodicity\n");

        for (const auto& p : trackPitch (mono, reader->sampleRate))
            csv << juce::String (p.time, 4) << "," << juce::String (p.hz, 3) << "," << juce::String (p.aperiodicity, 4) << "\n";

        return juce::File (args[3]).replaceWithText (csv) ? 0 : 1;
    }

    if (args[1] == "--host" && args.size() >= 3)
        return runHostTest (args[2]);

    if (args[1] == "--snapshot" && args.size() >= 3)
        return runSnapshot (juce::File (args[2]), args[3] == "live", args.size() > 4 ? args[4].getDoubleValue() : 1.0,
                            args.size() > 5 ? juce::jlimit (1.0f, 8.0f, args[5].getFloatValue()) : 2.0f);

    juce::File outDir;

    if (args[1] == "--out" && args.size() >= 3)
    {
        outDir = juce::File (args[2]);
        outDir.createDirectory();
    }

    testVersionCompare();
    testDetector();
    testHardTune (48000.0, outDir);
    testHardTune (44100.0, outDir);
    testHardTune (96000.0, outDir);
    testRetuneSpeed (outDir, LatencyMode::studio);
    testRetuneSpeed (outDir, LatencyMode::live);
    testScaleSnapping();
    testFastGlide (LatencyMode::studio);
    testFastGlide (LatencyMode::live);
    testFormantsAndMidi (outDir);
    testTransparency();
    testLiveMode (outDir);
    testLowVoice();
    testLiveNoteOnsets();
    testRealWorldVoices();
    testNoteFlips();
    testDropoutResume();
    testOctaveErrors();
    testOctaveSlips();
    testLeapsOntoFormant();
    testFastLeapUp();
    testModeSwitch();
    testGraphStaysStill();
    testBlockSizesAndCpu();
    testProcessorStereoAndState();

    std::printf ("\n%s: %d failure(s)\n", failures == 0 ? "ALL PASSED" : "FAILED", failures);
    return failures == 0 ? 0 : 1;
}
