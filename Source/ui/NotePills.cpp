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
    const float radius = 4.0f;

    // Notes in the scale sit on the control tone; the rest sink into the panel. Sharps are darker
    // still, a nod to the black keys of a piano.
    g.setColour (inScale ? palette::raised : (sharp ? palette::laneBlack : palette::panel));
    g.fillRoundedRectangle (pill, radius);
    g.setColour (hover ? palette::textDim.withAlpha (0.6f) : (inScale ? palette::lineBright : palette::line));
    g.drawRoundedRectangle (pill, radius, 1.0f);

    if (hasKeyboardFocus (false))
        drawFocusRing (g, pill, radius);

    // The note being tuned to right now: gold, with a bar along its foot.
    g.setColour (isTarget ? palette::accent : (inScale ? palette::text : palette::textFaint));
    g.setFont (uiFont (sharp ? 12.0f : 14.0f, true));
    g.drawText (getButtonText(), pill, Justification::centred);

    if (isTarget)
    {
        g.setColour (palette::accent);
        g.fillRect (pill.withTop (pill.getBottom() - 2.0f).reduced (radius, 0.0f));
    }

    if (isHeld)
    {
        g.setColour (palette::held);
        g.fillEllipse (Rectangle<float> (5.0f, 5.0f).withCentre ({ pill.getRight() - 6.5f, pill.getY() + 6.5f }));
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
