#include "ModeSwitch.h"
#include "SnapLookAndFeel.h"

namespace snaptune
{
ModeSwitch::Segment::Segment (const juce::String& label)
    : juce::Button (label)
{
    setTitle (label);
    setRadioGroupId (1);
    setClickingTogglesState (true);
}

void ModeSwitch::Segment::paintButton (juce::Graphics& g, bool highlighted, bool)
{
    using namespace juce;

    const auto bounds = getLocalBounds().toFloat();
    const bool on = getToggleState();

    if (on)
    {
        g.setColour (palette::accent);
        g.fillRoundedRectangle (bounds.reduced (2.0f), 4.5f);
    }

    if (hasKeyboardFocus (false))
        drawFocusRing (g, bounds.reduced (1.0f), 5.0f);

    g.setColour (on ? palette::background : (highlighted ? palette::text : palette::textDim));
    g.setFont (uiFont (12.5f, true));
    g.drawText (getButtonText(), bounds, Justification::centred);
}

ModeSwitch::ModeSwitch (juce::RangedAudioParameter& parameter)
    : attachment (parameter, [this] (float value)
                  {
                      selected = juce::roundToInt (value);

                      if (auto* segment = segments[selected])
                          segment->setToggleState (true, juce::dontSendNotification);
                  })
{
    setTitle ("Mode");

    const auto labels = parameter.getAllValueStrings();

    for (int i = 0; i < labels.size(); ++i)
    {
        auto* segment = segments.add (new Segment (labels[i]));
        segment->onClick = [this, i]
        {
            if (i != selected)
                attachment.setValueAsCompleteGesture ((float) i);
        };
        addAndMakeVisible (segment);
    }

    attachment.sendInitialUpdate();
}

void ModeSwitch::setTooltip (const juce::String& newTooltip)
{
    SettableTooltipClient::setTooltip (newTooltip);
    setHelpText (newTooltip);

    for (auto* segment : segments)
    {
        segment->setTooltip (newTooltip);
        segment->setHelpText (newTooltip);
    }
}

void ModeSwitch::paint (juce::Graphics& g)
{
    const auto bounds = getLocalBounds().toFloat().reduced (0.5f);
    g.setColour (palette::panelRaised);
    g.fillRoundedRectangle (bounds, 6.0f);
    g.setColour (palette::outline);
    g.drawRoundedRectangle (bounds, 6.0f, 1.0f);
}

void ModeSwitch::resized()
{
    auto area = getLocalBounds();
    const int segmentWidth = area.getWidth() / juce::jmax (1, segments.size());

    for (auto* segment : segments)
        segment->setBounds (area.removeFromLeft (segmentWidth));
}
} // namespace snaptune
