#pragma once

#include <juce_dsp/juce_dsp.h>

#include <memory>
#include <vector>

namespace snaptune
{
/** YIN fundamental-frequency estimator (de Cheveigné & Kawahara, 2002).

    The squared-difference function d(tau) = sum (x[j] - x[j + tau])^2 is expanded into
    energy terms (prefix sums) and a cross-correlation that is computed with real FFTs, so
    one analysis costs three FFTs instead of W * maxLag multiply-adds.
*/
class PitchDetector
{
public:
    struct Result
    {
        float period = 0.0f;       // samples, sub-sample accurate; 0 when nothing was measured
        float aperiodicity = 1.0f; // cumulative-mean-normalised difference at that lag (0 = perfectly periodic)
        float rms = 0.0f;          // level of the integration window
    };

    /** windowSize is YIN's integration window W; maxLag is the longest measurable period. */
    void prepare (int windowSize, int maxLag);

    /** Number of samples analyse() reads: W + maxLag. */
    int getFrameSize() const noexcept { return windowSize + maxLag; }

    /** `frame` holds getFrameSize() samples, oldest first. The integration window is anchored at
        the newest end of the frame so the estimate describes the most recent audio. A shorter
        `window` (0 = the prepared size) reacts faster at the cost of some robustness.
        `previousPeriod` (0 = none) is the period being tracked: when the pick lands on a multiple
        of it and the signal is still periodic there, the tracked period wins (no sub-harmonic jump). */
    Result analyse (const float* frame, float minPeriod, float maxPeriod, float threshold, int window = 0, float previousPeriod = 0.0f);

private:
    int windowSize = 0, maxLag = 0, fftSize = 0;
    std::unique_ptr<juce::dsp::FFT> fft;
    std::vector<float> newestFirst, spectrumA, spectrumB, cmnd;
    std::vector<double> energyPrefix, difference;
    float inverseScale = 1.0f;
};
} // namespace snaptune
