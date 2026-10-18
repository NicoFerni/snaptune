#include "NotePills.h"
#include "../dsp/Scales.h"
#include "SnapLookAndFeel.h"

namespace snaptune
{
namespace
{
    constexpr int gap = 5;

    bool isSharp (int pc) { return pc == 1 || pc == 3 || pc == 6 || pc == 8 || pc == 10; }
} // namespace

NotePills::Pill::Pill (int pc)
    : juce::Button (noteNames[(size_t) pc]),
      pitchClass (pc)
{
    // "C#" would be read as "C number sign".
    setTitle (juce::String (noteNames[(size_t) pc]).replace ("#", " sharp"));
    setToggleable (true);
}

void NotePills::Pill::paintButton (juce::Graphics& g, bool hover, bool)
{
    using namespace juce;

    const auto pill = getLocalBounds().toFloat().reduced (0.5f);
    const bool inScale = getToggleState();
    const bool sharp = isSharp (pitchClass);
    const float radius = 8.0f;

    // Sharps sit on a darker base, a nod to the black keys of a piano.
    g.setColour (sharp ? Colour (0xff0d1015) : palette::panelRaised);
    g.fillRoundedRectangle (pill, radius);

    if (isTarget)
    {
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

    if (hasKeyboardFocus (false))
        drawFocusRing (g, pill, radius);

    g.setColour (isTarget ? palette::background : (inScale ? palette::accent : palette::textFaint));
    g.setFont (uiFont (sharp ? 12.0f : 14.0f, true));
    g.drawText (getButtonText(), pill, Justification::centred);

    if (isHeld)
    {
        g.setColour (palette::midi);
        g.fillEllipse (Rectangle<float> (6.0f, 6.0f).withCentre ({ pill.getRight() - 7.0f, pill.getY() + 7.0f }));
    }
}

//==============================================================================
NotePills::NotePills()
{
    setTitle ("Scale notes");

    for (int pc = 0; pc < 12; ++pc)
    {
        auto* pill = pills.add (new Pill (pc));
        pill->onClick = [this, pc]
        {
            if (onToggle)
                onToggle (pc);
        };
        addAndMakeVisible (pill);
    }

    setState (allowed, held, target);
}

void NotePills::setState (uint16_t newAllowed, uint16_t newHeld, int newTarget)
{
    allowed = newAllowed;
    held = newHeld;
    target = newTarget;

    for (auto* pill : pills)
    {
        const int pc = pill->pitchClass;
        const bool isTarget = pc == target;
        const bool isHeld = ((held >> pc) & 1u) != 0;

        if (isTarget != pill->isTarget)
            repaint();

        if (isTarget != pill->isTarget || isHeld != pill->isHeld)
        {
            pill->isTarget = isTarget;
            pill->isHeld = isHeld;
            pill->repaint();
        }

        pill->setToggleState (((allowed >> pc) & 1u) != 0, juce::dontSendNotification);
    }
}

void NotePills::setTooltip (const juce::String& newTooltip)
{
    SettableTooltipClient::setTooltip (newTooltip);
    setHelpText (newTooltip);

    for (auto* pill : pills)
    {
        pill->setTooltip (newTooltip);
        pill->setHelpText (newTooltip);
    }
}

void NotePills::paint (juce::Graphics& g)
{
    // The target's glow spills into the gaps, outside its own bounds.
    if (auto* pill = pills[target])
    {
        g.setColour (palette::accent.withAlpha (0.18f));
        g.fillRoundedRectangle (pill->getBounds().toFloat().expanded (3.0f), 11.0f);
    }
}

void NotePills::resized()
{
    const int width = getWidth();

    for (int pc = 0; pc < 12; ++pc)
    {
        // Spread the rounding so the twelve pills and eleven gaps fill the width exactly.
        const int left = (pc * (width + gap)) / 12;
        const int right = ((pc + 1) * (width + gap)) / 12 - gap;
        pills[pc]->setBounds (left, 0, right - left, getHeight());
    }
}
} // namespace snaptune
