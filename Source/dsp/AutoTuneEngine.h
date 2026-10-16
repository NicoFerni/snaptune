#pragma once

#include "PitchDetector.h"
#include "Scales.h"

#include <juce_audio_basics/juce_audio_basics.h>

#include <array>
#include <atomic>
#include <cstdint>
#include <vector>

namespace snaptune
{
enum class VoiceType : int
{
    soprano,
    altoTenor,
    lowMale,
    instrument,
    numTypes
};

/** Studio: TD-PSOLA, formant-preserving, ~46 ms latency (compensated by the host).
    Live: pitch-synchronous delay-line resampling (the original Auto-Tune method), a few ms of
    latency for monitoring while recording; formants move with the (usually small) correction. */
enum class LatencyMode : int
{
    studio,
    live
};

struct EngineSettings
{
    int key = 0;
    Scale scale = Scale::chromatic;
    uint16_t customMask = 0x0fff;
    float retuneMs = 20.0f;       // time to reach the target note; 0 = instant ("hard tune")
    float humanize = 0.0f;        // 0..1, relaxes correction on sustained notes
    float amount = 1.0f;          // 0..1, fraction of the pitch error that is corrected
    float formantSemitones = 0.0f;
    float mix = 1.0f;             // 0..1 dry/wet
    float tracking = 0.5f;        // 0..1, higher accepts breathier / noisier input as pitched
    VoiceType voice = VoiceType::altoTenor;
    bool midiTargets = false;     // held MIDI notes replace the scale
    float referenceHz = 440.0f;
    LatencyMode mode = LatencyMode::studio;
};

/** One analysis hop of pitch data, published lock-free for the editor. */
struct PitchFrame
{
    float inputNote = 0.0f;  // detected pitch, fractional MIDI note
    float outputNote = 0.0f; // pitch after correction
    int targetNote = -1;
    bool voiced = false;
};

/** Real-time pitch corrector.

    Pipeline per sample:
      1. A YIN detector runs every hop on a high-passed mono sum and yields period + voicing.
      2. The detected note is snapped to the nearest allowed note; the correction (in semitones)
         is smoothed by a one-pole whose time constant is the retune speed.
      3. Pitch marks are placed one period apart on the input, locked to the waveform peaks.
      4. TD-PSOLA: two-period Hann grains centred on the marks are overlap-added at the corrected
         spacing. Because the grains are not resampled, the formants stay where they were.
         A formant control optionally resamples the grains to move the formants on purpose.

    In Studio mode the engine runs a fixed 3 periods of the lowest detectable pitch behind the input.
    Live mode skips steps 3-4: the input is read through a delay line at the corrected speed, and
    whenever the read point drifts a whole cycle it jumps back or forward one cycle (located by
    cross-correlation, crossfaded), so the delay stays within about one period of the voice.
    Either latency is reported to the host for delay compensation.
*/
class AutoTuneEngine
{
public:
    AutoTuneEngine();

    void prepare (double sampleRate, int maxChannels);
    void reset();

    /** Latency of the active mode. Changes when settings switch between Studio and Live. */
    int getLatencySamples() const noexcept { return latency; }
    LatencyMode getActiveMode() const noexcept { return activeMode; }
    double getFramesPerSecond() const noexcept { return sampleRate / hopSize; }

    void setSettings (const EngineSettings& newSettings) noexcept { settings = newSettings; }

    void noteOn (int note) noexcept;
    void noteOff (int note) noexcept;
    void allNotesOff() noexcept;

    /** Processes channels[c][startSample .. startSample + numSamples) in place. */
    void process (float* const* channels, int numChannels, int startSample, int numSamples, bool bypassed = false);

    /** Editor side: pops up to maxFrames pending pitch frames. Single consumer only. */
    int popFrames (PitchFrame* destination, int maxFrames);

    /** Pitch classes of the MIDI notes currently held (bit 0 = C). */
    uint16_t getHeldNoteMask() const noexcept { return heldMaskForUi.load (std::memory_order_relaxed); }

private:
    struct TrackEntry
    {
        double time = 0.0;
        float period = 0.0f;
        float correction = 0.0f;
        bool voiced = false;
    };

    struct TrackSample
    {
        float period = 0.0f;
        float correction = 0.0f;
        bool voiced = false;
    };

    struct Mark
    {
        double position = 0.0;
        float period = 0.0f;
        bool voiced = false;
    };

    void analyseHop();
    void updateCorrection (bool voiced, float period);
    TrackSample trackAt (double time) const noexcept;

    /** Extends the pitch marks up to newestReadable (peak refinement reads one sample past it). */
    void generateMarks (int64_t newestReadable);
    void pushMark (const Mark& m) noexcept;
    double refinePeak (int64_t index) const noexcept;
    const Mark& markAt (int64_t index) const noexcept { return marks[(size_t) (index & markMask)]; }
    int64_t oldestMark() const noexcept;
    int64_t findSourceMark (double synthesisTime) noexcept;

    void studioSample (float* wet);
    void liveSample (float* wet);
    void maybeSplice (double ratio);
    double findSpliceLength (double tap, int direction, double minLength, double maxLength, double period) const;
    void startSplice (double offset, double fadeSamples, bool uncorrelated);
    void switchMode (LatencyMode mode);
    float readInput (int channel, double position) const noexcept;

    void emitGrain (int64_t now);
    void writeGrain (int64_t now, double centre, double source, double halfLeft, double halfRight, float gain);
    float window (double x) const noexcept;

    void pushFrame (const PitchFrame& frame) noexcept;
    void updateHeldMask() noexcept;

    EngineSettings settings;

    double sampleRate = 48000.0;
    int maxChannels = 2, activeChannels = 2;
    int maxPeriod = 0, hopSize = 128, latency = 0, unvoicedPeriod = 240, scheduleAhead = 0;
    int studioLatency = 0, liveLatency = 0;
    LatencyMode activeMode = LatencyMode::studio;
    int switchFadePosition = 0, switchFadeLength = 1;

    int ringSize = 0, ringMask = 0;
    std::array<std::vector<float>, 2> inputRing, outputRing;
    std::vector<float> detectionRing, peakRing;
    int64_t writePos = 0;

    // Analysis-signal filters: high-pass for the detector, extra low-pass for peak picking.
    float hpCoeff = 0.0f, hpLastIn = 0.0f, hpLastOut = 0.0f;
    float lpCoeff = 0.0f, lpState = 0.0f;

    PitchDetector detector;
    std::vector<float> frame;
    std::array<float, 3> recentPeriods {};
    int recentCount = 0;
    bool jumpPending = false;
    double estimateDelay = 0.0; // how far behind the newest sample the latest estimate is centred, minus half a period

    // Correction state (one value per hop).
    bool wasVoiced = false;
    int currentTarget = -1;
    float correction = 0.0f;
    float noteAge = 0.0f;
    std::vector<TrackEntry> track;
    int64_t trackCount = 0;
    double lastTrackTime = 0.0;
    float stampPeriod = 0.0f;

    // Pitch marks on the input timeline.
    std::vector<Mark> marks;
    int64_t markCount = 0;
    int64_t markMask = 0;
    float markPolarity = 1.0f;

    // Synthesis.
    double synthesisTime = 0.0;
    double lastCentre = 0.0;
    double lastStep = 0.0;
    int64_t lastSourceMark = -1;
    bool lastGrainVoiced = false;
    double formantStretch = 1.0;
    std::vector<float> windowTable;
    juce::SmoothedValue<float> mixSmoothed;

    // Live mode: delay-line read tap with pitch-synchronous splices.
    double liveMinDelay = 8.0;
    double liveTap = 0.0, spliceTap = 0.0;
    int fadeLength = 0, fadePosition = 0;
    bool fadeEqualPower = false;
    double liveCorrectionFrom = 0.0, liveCorrectionTo = 0.0;
    int liveRamp = 0;

    // MIDI target notes.
    std::array<int, 128> heldNotes {};
    uint16_t heldMask = 0;
    std::atomic<uint16_t> heldMaskForUi { 0 };

    // Audio -> editor pitch frames.
    static constexpr int frameFifoSize = 2048;
    juce::AbstractFifo frameFifo { frameFifoSize };
    std::array<PitchFrame, frameFifoSize> frameBuffer {};
};
} // namespace snaptune
