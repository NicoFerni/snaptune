#pragma once

#include "Scales.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

namespace snaptune
{
/** Suggests the key from the pitch the engine already tracks: how long the voice spends on each of
    the twelve notes, compared with every major scale.

    A voice that needs tuning is off its notes, so a frame counts for less the further it is from
    the centre of a semitone, and frames inside a slide (a scoop into a note, a glide between two)
    don't count. Each scale is scored by the share of the singing that lands on its notes, plus how
    well the time on each note matches how often music in that key uses it (Temperley's key
    profiles): a few seconds of a melody rarely touch all seven notes, and the profiles separate
    scales that fit the notes heard equally well.

    A major scale and its relative minor are the same notes, so there are twelve answers, not
    twenty-four; the name is whichever of the two the melody leans on.

    Measured on pop melodies (POP909, the 378 songs the weights weren't chosen on) sung by a
    simulated singer 30 cents off: after 20 s the scale is right 79 % of the time and among the
    first three 99 %, and hard tune then moves 8 % of the singing to a note that wasn't meant,
    against 20 % with Chromatic and 7 % with the true key. The misses are nearly all a
    neighbouring key, one note apart. */
class KeyFinder
{
public:
    struct Suggestion
    {
        int key = 0;                // tonic, as a pitch class (0 = C)
        Scale scale = Scale::major; // major or minor
        float score = 0.0f;

        uint16_t mask() const noexcept { return pitchClassMask (key, scale, 0); }
    };

    /** Forgets what was heard. `framesPerSecond` is the rate push() is called at. */
    void reset (double framesPerSecond)
    {
        lookback = std::max (1, (int) std::lround (slideWindowSeconds * framesPerSecond));
        secondsPerFrame = framesPerSecond > 0.0 ? 1.0 / framesPerSecond : 0.0;
        recent.assign ((size_t) lookback + 1, silent);
        position = 0;
        time.fill (0.0);
        voicedFrames = 0;
    }

    /** One analysis hop: the detected pitch as a fractional MIDI note. */
    void push (float note, bool voiced) noexcept
    {
        if (recent.empty())
            return;

        // The ring holds the last `lookback` + 1 frames: the new one replaces the oldest, and the one
        // after it is `lookback` frames back.
        const int size = (int) recent.size();
        position = (position + 1) % size;
        const float earlier = recent[(size_t) ((position + 1) % size)];
        recent[(size_t) position] = voiced ? note : silent;

        if (! voiced)
            return;

        ++voicedFrames;

        if (earlier <= silent || std::abs (note - earlier) >= slideSemitones)
            return;

        const float nearest = std::round (note);
        const float weight = std::max (0.0f, 1.0f - 2.0f * std::abs (note - nearest));
        time[(size_t) pitchClass ((int) nearest)] += (double) weight;
    }

    /** How long the voice has been heard, slides and off-centre singing included. */
    double secondsSung() const noexcept { return (double) voicedFrames * secondsPerFrame; }

    /** Each note's share of the singing counted so far (they add up to 1, or are all 0). */
    std::array<float, 12> noteShares() const noexcept
    {
        std::array<float, 12> shares {};
        const double total = totalTime();

        if (total > 0.0)
            for (size_t i = 0; i < 12; ++i)
                shares[i] = (float) (time[i] / total);

        return shares;
    }

    /** Writes up to `maxSuggestions` scales, best first, each a different set of notes. Returns how
        many (0 until something has been counted). */
    int suggest (Suggestion* destination, int maxSuggestions) const noexcept
    {
        if (totalTime() <= 0.0 || maxSuggestions <= 0)
            return 0;

        const auto shares = noteShares();
        std::array<Suggestion, 12> all;

        for (int root = 0; root < 12; ++root)
        {
            const int minorRoot = (root + 9) % 12; // the relative minor: the same notes
            float inScale = 0.0f;

            for (int pc = 0; pc < 12; ++pc)
                if (maskContains (pitchClassMask (root, Scale::major, 0), pc))
                    inScale += shares[(size_t) pc];

            const float asMajor = correlation (shares, majorProfile, root);
            const float asMinor = correlation (shares, minorProfile, minorRoot);
            const bool minor = asMinor > asMajor;

            all[(size_t) root] = { minor ? minorRoot : root, minor ? Scale::minor : Scale::major, inScale + profileWeight * std::max (asMajor, asMinor) };
        }

        std::stable_sort (all.begin(), all.end(), [] (const Suggestion& a, const Suggestion& b) { return a.score > b.score; });

        const int count = std::min (maxSuggestions, 12);
        std::copy (all.begin(), all.begin() + count, destination);
        return count;
    }

private:
    // A frame is part of a slide when the pitch has moved this far in this long (10 semitones a second).
    static constexpr double slideWindowSeconds = 0.03;
    static constexpr float slideSemitones = 0.3f;
    static constexpr float silent = -1000.0f;

    // How much the profiles count next to the share of singing inside the scale. On POP909, 0.2 found
    // the scale most often of 0.02 to 0.4, and these profiles more often than Krumhansl and
    // Kessler's (79 % against 66 % after 20 s).
    static constexpr float profileWeight = 0.2f;

    // How often each degree above the tonic is used in a key, counted in the Kostka-Payne corpus
    // (D. Temperley, "Music and Probability", 2007).
    static constexpr std::array<float, 12> majorProfile { 0.748f, 0.060f, 0.488f, 0.082f, 0.670f, 0.460f, 0.096f, 0.715f, 0.104f, 0.366f, 0.057f, 0.400f };
    static constexpr std::array<float, 12> minorProfile { 0.712f, 0.084f, 0.474f, 0.618f, 0.049f, 0.460f, 0.105f, 0.747f, 0.404f, 0.067f, 0.133f, 0.330f };

    double totalTime() const noexcept
    {
        double total = 0.0;

        for (auto t : time)
            total += t;

        return total;
    }

    /** Pearson correlation of the shares with a profile whose tonic is `root`. */
    static float correlation (const std::array<float, 12>& shares, const std::array<float, 12>& profile, int root) noexcept
    {
        double meanShare = 0.0, meanProfile = 0.0;

        for (size_t i = 0; i < 12; ++i)
        {
            meanShare += shares[i] / 12.0;
            meanProfile += profile[i] / 12.0;
        }

        double cross = 0.0, shareEnergy = 0.0, profileEnergy = 0.0;

        for (int pc = 0; pc < 12; ++pc)
        {
            const double s = shares[(size_t) pc] - meanShare;
            const double p = profile[(size_t) pitchClass (pc - root)] - meanProfile;
            cross += s * p;
            shareEnergy += s * s;
            profileEnergy += p * p;
        }

        const double energy = std::sqrt (shareEnergy * profileEnergy);
        return energy > 0.0 ? (float) (cross / energy) : 0.0f;
    }

    std::vector<float> recent; // the last `lookback` + 1 pitches, `silent` where there was none
    int lookback = 1, position = 0;
    double secondsPerFrame = 0.0;
    std::array<double, 12> time {};
    int64_t voicedFrames = 0;
};
} // namespace snaptune
