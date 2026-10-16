#include "NotePills.h"
#include "../dsp/Scales.h"
#include "SnapLookAndFeel.h"

namespace snaptune
{
namespace
{
    constexpr float gap = 5.0f;

    bool isSharp (int pc) { return pc == 1 || pc == 3 || pc == 6 || pc == 8 || pc == 10; }
} // namespace

void NotePills::setState (uint16_t newAllowed, uint16_t newHeld, int newTarget)
{
    if (newAllowed != allowed || newHeld != held || newTarget != target)
    {
        allowed = newAllowed;
        held = newHeld;
        target = newTarget;
        repaint();
    }
}

juce::Rectangle<float> NotePills::pillBounds (int pc) const
{
    const auto area = getLocalBounds().toFloat();
    const float width = (area.getWidth() - gap * 11.0f) / 12.0f;
    return { area.getX() + (float) pc * (width + gap), area.getY(), width, area.getHeight() };
}

int NotePills::pillAt (juce::Point<float> position) const
{
    for (int pc = 0; pc < 12; ++pc)
        if (pillBounds (pc).expanded (gap * 0.5f, 0.0f).contains (position))
            return pc;

    return -1;
}

void NotePills::paint (juce::Graphics& g)
{
    using namespace juce;

    for (int pc = 0; pc < 12; ++pc)
    {
        const auto pill = pillBounds (pc).reduced (0.5f);
        const bool inScale = ((allowed >> pc) & 1u) != 0;
        const bool isTarget = pc == target;
        const bool hover = pc == hovered;
        const float radius = 8.0f;

        // Sharps sit on a darker base, a nod to the black keys of a piano.
        g.setColour (isSharp (pc) ? Colour (0xff0d1015) : palette::panelRaised);
        g.fillRoundedRectangle (pill, radius);

        if (isTarget)
        {
            g.setColour (palette::accent.withAlpha (0.18f));
            g.fillRoundedRectangle (pill.expanded (3.0f), radius + 3.0f);
            g.setGradientFill (ColourGradient (palette::accent, 0.0f, pill.getY(), palette::accentDeep, 0.0f, pill.getBottom(), false));
            g.fillRoundedRectangle (pill, radius);
        }
        else if (inScale)
        {
            g.setColour (palette::accent.withAlpha (hover ? 0.2f : 0.12f));
            g.fillRoundedRectangle (pill, radius);
            g.setColour (palette::accent.withAlpha (0.55f));
            g.drawRoundedRectangle (pill, radius, 1.0f);
        }
        else
        {
            g.setColour (hover ? palette::outlineBright : palette::outline);
            g.drawRoundedRectangle (pill, radius, 1.0f);
        }

        g.setColour (isTarget ? palette::background : (inScale ? palette::accent : palette::textFaint));
        g.setFont (uiFont (isSharp (pc) ? 12.0f : 14.0f, true));
        g.drawText (noteNames[(size_t) pc], pill, Justification::centred);

        if (((held >> pc) & 1u) != 0)
        {
            g.setColour (palette::midi);
            g.fillEllipse (Rectangle<float> (6.0f, 6.0f).withCentre ({ pill.getRight() - 7.0f, pill.getY() + 7.0f }));
        }
    }
}

void NotePills::mouseDown (const juce::MouseEvent& event)
{
    const int pc = pillAt (event.position);

    if (pc >= 0 && onToggle)
        onToggle (pc);
}

void NotePills::mouseMove (const juce::MouseEvent& event)
{
    const int pc = pillAt (event.position);

    if (pc != hovered)
    {
        hovered = pc;
        repaint();
    }
}

void NotePills::mouseExit (const juce::MouseEvent&)
{
    hovered = -1;
    repaint();
}
} // namespace snaptune
