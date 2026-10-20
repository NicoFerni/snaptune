#include "PitchGraph.h"
#include "SnapLookAndFeel.h"

namespace snaptune
{
namespace
{
    constexpr float keyboardWidth = 46.0f;
    constexpr float cornerRadius = 5.0f;

    bool isBlackKey (int note)
    {
        const int pc = pitchClass (note);
        return pc == 1 || pc == 3 || pc == 6 || pc == 8 || pc == 10;
    }

    /** Dashed outline of a polyline. JUCE's createDashedStroke bridges the gaps between sub-paths,
        so each one is dashed on its own. */
    juce::Path dashedStroke (const juce::Path& source, float thickness)
    {
        using namespace juce;

        const float dashes[] = { 5.0f, 4.0f };
        const PathStrokeType stroke (thickness, PathStrokeType::curved, PathStrokeType::butt);
        Path result, piece;

        auto flush = [&]
        {
            if (! piece.isEmpty())
            {
                Path dashed;
                stroke.createDashedStroke (dashed, piece, dashes, 2);
                result.addPath (dashed);
                piece.clear();
            }
        };

        for (Path::Iterator it (source); it.next();)
        {
            if (it.elementType == Path::Iterator::startNewSubPath)
            {
                flush();
                piece.startNewSubPath (it.x1, it.y1);
            }
            else if (it.elementType == Path::Iterator::lineTo)
            {
                piece.lineTo (it.x1, it.y1);
            }
        }

        flush();
        return result;
    }
} // namespace

PitchGraph::PitchGraph()
{
    history.resize (4096);
    viewLow = targetLow = (float) homeNote - std::floor (span * 0.5f) - 0.5f;
}

void PitchGraph::setFramesPerSecond (double fps)
{
    framesPerSecond = juce::jmax (1.0, fps);
}

void PitchGraph::setAllowedMask (uint16_t mask)
{
    if (mask != allowedMask)
    {
        allowedMask = mask;
        repaint();
    }
}

const PitchFrame& PitchGraph::frameAgo (int age) const
{
    const auto size = (int) history.size();
    return history[(size_t) (((head - 1 - age) % size + size) % size)];
}

int PitchGraph::visibleFrames() const
{
    return juce::jlimit (16, (int) history.size() - 1, (int) (framesPerSecond * visibleSeconds));
}

void PitchGraph::setHomeNote (int note)
{
    if (note == homeNote)
        return;

    homeNote = note;

    // Before anything has been sung, show the range the selected voice sits in.
    if (followSinger && ! hasFollowed)
    {
        moveViewTo ((float) homeNote - std::floor (span * 0.5f) - 0.5f);
        viewLow = targetLow;
        repaint();
    }
}

void PitchGraph::moveViewTo (float lowestNote)
{
    targetLow = juce::jlimit (12.0f - 0.5f, 108.0f - span + 0.5f, lowestNote);
}

const PitchFrame* PitchGraph::latestVoiced (double withinSeconds) const
{
    for (int age = 0; age < (int) (framesPerSecond * withinSeconds) && age < totalFrames; ++age)
        if (frameAgo (age).voiced)
            return &frameAgo (age);

    return nullptr;
}

void PitchGraph::pushFrames (const PitchFrame* frames, int count)
{
    for (int i = 0; i < count; ++i)
    {
        const auto& f = frames[i];
        history[(size_t) head] = f;
        head = (head + 1) % (int) history.size();
        ++totalFrames;

        // Count how long the voice has been outside the visible rows.
        if (f.voiced)
            outOfViewFrames = (f.outputNote < targetLow + 0.5f || f.outputNote > targetLow + span - 0.5f) ? outOfViewFrames + 1 : 0;
    }

    // The rows only move once the singer has been out of view for a quarter of a second, and then
    // jump to put that note in the middle: a still grid you can read, never a constant drift.
    if (followSinger && outOfViewFrames > (int) (framesPerSecond * 0.25))
    {
        if (const auto* latest = latestVoiced (0.1))
        {
            moveViewTo (std::round (latest->outputNote) - std::floor (span * 0.5f) - 0.5f);
            hasFollowed = true;
        }

        outOfViewFrames = 0;
    }

    viewLow += 0.35f * (targetLow - viewLow);

    if (std::abs (targetLow - viewLow) < 0.01f)
        viewLow = targetLow;

    repaint();
}

void PitchGraph::mouseWheelMove (const juce::MouseEvent&, const juce::MouseWheelDetails& wheel)
{
    followSinger = false;
    const float steps = (wheel.deltaY != 0.0f ? wheel.deltaY : wheel.deltaX) * (wheel.isReversed ? -1.0f : 1.0f) * 8.0f;
    moveViewTo (targetLow + (std::abs (steps) < 1.0f ? (steps > 0.0f ? 1.0f : -1.0f) : std::round (steps)));
    viewLow = targetLow;
    repaint();
}

void PitchGraph::mouseDown (const juce::MouseEvent&)
{
    dragStartLow = targetLow;
}

void PitchGraph::mouseDrag (const juce::MouseEvent& event)
{
    followSinger = false;
    const float rowHeight = (float) getHeight() / span;
    moveViewTo (std::round (dragStartLow + (float) event.getDistanceFromDragStartY() / rowHeight));
    viewLow = targetLow;
    repaint();
}

void PitchGraph::mouseDoubleClick (const juce::MouseEvent&)
{
    followSinger = true;
    const auto* latest = latestVoiced (2.0);
    moveViewTo ((latest != nullptr ? std::round (latest->outputNote) : (float) homeNote) - std::floor (span * 0.5f) - 0.5f);
    viewLow = targetLow;
    repaint();
}

void PitchGraph::paint (juce::Graphics& g)
{
    using namespace juce;

    const auto bounds = getLocalBounds().toFloat();
    Path clip;
    clip.addRoundedRectangle (bounds, cornerRadius);
    g.reduceClipRegion (clip);

    const auto keys = bounds.withWidth (keyboardWidth);
    const auto plot = bounds.withTrimmedLeft (keyboardWidth);
    const float low = viewLow;
    const float high = viewLow + span;
    const float rowHeight = bounds.getHeight() / span;

    auto noteToY = [&] (float note) { return bounds.getBottom() - (note - low) / (high - low) * bounds.getHeight(); };

    // Lanes and keys, piano-roll style.
    int liveTarget = -1;

    for (int age = 0; age < (int) (framesPerSecond * 0.15) && age < totalFrames; ++age)
        if (frameAgo (age).voiced)
        {
            liveTarget = frameAgo (age).targetNote;
            break;
        }

    for (int note = (int) std::floor (low) - 1; note <= (int) std::ceil (high) + 1; ++note)
    {
        const float yTop = noteToY ((float) note + 0.5f);
        const auto lane = Rectangle<float> (plot.getX(), yTop, plot.getWidth(), rowHeight);
        const auto key = Rectangle<float> (keys.getX(), yTop, keys.getWidth(), rowHeight);
        const bool black = isBlackKey (note);
        const bool inScale = maskContains (allowedMask, note);

        g.setColour (black ? palette::laneBlack : palette::panel);
        g.fillRect (lane);

        if (inScale)
        {
            g.setColour (palette::text.withAlpha (0.025f));
            g.fillRect (lane);
        }

        // The keyboard: the notes in the scale are lit ivory keys, the one being tuned to is gold.
        g.setColour (note == liveTarget ? palette::accent : (inScale ? palette::raised : (black ? palette::laneBlack : palette::panel)));
        g.fillRect (key.withTrimmedRight (1.0f));

        // Row separators, with a stronger line under every C.
        g.setColour (pitchClass (note) == 0 ? palette::line : palette::grid);
        g.fillRect (Rectangle<float> (bounds.getX(), yTop + rowHeight - 1.0f, bounds.getWidth(), 1.0f));

        if ((inScale || pitchClass (note) == 0) && rowHeight > 11.0f)
        {
            g.setColour (note == liveTarget ? palette::background : (inScale ? palette::text : palette::textDim));
            g.setFont (uiFont (jmin (11.5f, rowHeight * 0.58f), true));
            g.drawText (String (noteName (note)) + String (noteOctave (note)), key.withTrimmedRight (7.0f), Justification::centredRight);
        }
    }

    g.setColour (palette::line);
    g.fillRect (Rectangle<float> (plot.getX() - 1.0f, bounds.getY(), 1.0f, bounds.getHeight()));

    // One-second grid.
    const int visible = visibleFrames();
    const float dx = plot.getWidth() / (float) visible;
    const float secondWidth = (float) framesPerSecond * dx;
    const float phase = (float) std::fmod ((double) totalFrames, framesPerSecond) * dx;

    for (float x = plot.getRight() - phase; x > plot.getX(); x -= secondWidth)
    {
        g.setColour (palette::text.withAlpha (0.035f));
        g.fillRect (Rectangle<float> (x, bounds.getY(), 1.0f, bounds.getHeight()));
    }

    // Pitch curves: thin out to ~one point per pixel, and fade them toward the past.
    const int count = (int) jmin<int64_t> (totalFrames, (int64_t) visible);
    const int stride = jmax (1, (int) std::floor (1.0f / jmax (dx, 0.01f)));
    bool anyVoiced = false;

    auto buildPath = [&] (bool corrected)
    {
        Path path;
        bool penDown = false;
        float previous = 0.0f;

        for (int age = count - 1; age >= 0; --age)
        {
            const auto& f = frameAgo (age);

            if (! f.voiced)
            {
                penDown = false;
                continue;
            }

            if (age % stride != 0 && penDown)
                continue;

            anyVoiced = true;
            const float note = corrected ? f.outputNote : f.inputNote;
            const Point<float> p (plot.getRight() - (float) age * dx, noteToY (note));

            if (! penDown || std::abs (note - previous) > 3.0f)
                path.startNewSubPath (p);
            else
                path.lineTo (p);

            penDown = true;
            previous = note;
        }

        return path;
    };

    auto fading = [&] (Colour colour)
    {
        return FillType (ColourGradient (colour.withAlpha (0.0f), plot.getX(), 0.0f, colour, plot.getX() + plot.getWidth() * 0.4f, 0.0f, false));
    };

    {
        Graphics::ScopedSaveState state (g);
        g.reduceClipRegion (plot.toNearestInt());

        // The sung line is dashed so the two curves differ by more than colour.
        g.setFillType (fading (palette::input.withAlpha (0.85f)));
        g.fillPath (dashedStroke (buildPath (false), 1.6f));

        g.setFillType (fading (palette::accent));
        g.strokePath (buildPath (true), PathStrokeType (2.4f, PathStrokeType::curved, PathStrokeType::rounded));
    }

    // "Now" marker on the newest voiced frame, with the note it is tuned to.
    for (int age = 0; age < (int) (framesPerSecond * 0.15) && age < count; ++age)
    {
        const auto& f = frameAgo (age);

        if (! f.voiced)
            continue;

        const Point<float> dot (plot.getRight() - (float) age * dx - 4.0f, noteToY (f.outputNote));
        g.setColour (palette::accent);
        g.fillEllipse (Rectangle<float> (8.0f, 8.0f).withCentre (dot));

        if (f.targetNote >= 0)
        {
            const auto label = String (noteName (f.targetNote)) + String (noteOctave (f.targetNote));
            auto tag = Rectangle<float> (40.0f, 20.0f).withCentre (dot.translated (-24.0f, -22.0f));

            if (tag.getY() < bounds.getY() + 4.0f)
                tag.setY (dot.y + 12.0f);
            g.setColour (palette::panel);
            g.fillRoundedRectangle (tag, 3.0f);
            g.setColour (palette::accent.withAlpha (0.7f));
            g.drawRoundedRectangle (tag, 3.0f, 1.0f);
            g.setColour (palette::accent);
            g.setFont (uiFont (12.0f, true));
            g.drawText (label, tag, Justification::centred);
        }

        break;
    }

    // Arrow at the edge when the voice is above or below the rows on screen.
    if (const auto* latest = latestVoiced (0.15))
    {
        const bool above = latest->outputNote > high - 0.3f;
        const bool below = latest->outputNote < low + 0.3f;

        if (above || below)
        {
            const auto tag = Rectangle<float> (58.0f, 22.0f).withCentre ({ plot.getRight() - 40.0f, above ? bounds.getY() + 16.0f : bounds.getBottom() - 16.0f });
            g.setColour (palette::panel);
            g.fillRoundedRectangle (tag, 3.0f);
            g.setColour (palette::accent);
            g.drawRoundedRectangle (tag, 3.0f, 1.0f);

            Path arrow;
            const float ax = tag.getX() + 12.0f, ay = tag.getCentreY();
            arrow.addTriangle (ax - 4.0f, above ? ay + 2.5f : ay - 2.5f, ax + 4.0f, above ? ay + 2.5f : ay - 2.5f, ax, above ? ay - 3.5f : ay + 3.5f);
            g.fillPath (arrow);

            const int note = latest->targetNote >= 0 ? latest->targetNote : (int) std::lround (latest->outputNote);
            g.setFont (uiFont (12.0f, true));
            g.drawText (String (noteName (note)) + String (noteOctave (note)), tag.withTrimmedLeft (20.0f), Justification::centredLeft);
        }
    }

    if (! anyVoiced)
    {
        g.setColour (palette::text);
        g.setFont (uiFont (14.0f, true));
        g.drawText ("Sing, or play a vocal", plot.withTrimmedBottom (20.0f), Justification::centred);
        g.setColour (palette::textDim);
        g.setFont (uiFont (12.5f));
        g.drawText ("Its pitch and the tuned pitch will draw here.", plot.withTrimmedTop (24.0f), Justification::centred);
    }

    // Legend at the top left, clear of the out-of-range arrow on the right, on a backing so curves
    // near the top row pass behind it rather than through the text.
    auto legend = Rectangle<float> (plot.getX() + 10.0f, bounds.getY() + 8.0f, 146.0f, 22.0f);
    g.setColour (palette::panel);
    g.fillRoundedRectangle (legend, 3.0f);
    g.setColour (palette::line);
    g.drawRoundedRectangle (legend, 3.0f, 1.0f);
    legend.reduce (10.0f, 3.0f);

    auto drawKey = [&] (Colour colour, bool dashed, const String& label)
    {
        auto item = legend.removeFromLeft (legend.getWidth() * (dashed ? 0.46f : 1.0f));
        const auto swatch = item.removeFromLeft (14.0f).withSizeKeepingCentre (14.0f, dashed ? 2.0f : 3.0f);
        g.setColour (colour);

        if (dashed)
        {
            g.fillRect (swatch.withWidth (5.0f));
            g.fillRect (swatch.withTrimmedLeft (9.0f));
        }
        else
        {
            g.fillRoundedRectangle (swatch, 1.5f);
        }

        g.setColour (palette::textDim);
        g.setFont (uiFont (12.0f));
        g.drawText (label, item.withTrimmedLeft (6.0f), Justification::centredLeft);
    };

    drawKey (palette::input, true, "Sung");
    drawKey (palette::accent, false, "Output");
}
} // namespace snaptune
