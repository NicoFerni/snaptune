#include "ModeSwitch.h"
#include "SnapLookAndFeel.h"

namespace snaptune
{
ModeSwitch::ModeSwitch (juce::RangedAudioParameter& parameter)
    : attachment (parameter, [this] (float value)
                  {
                      selected = juce::roundToInt (value);
                      repaint();
                  }),
      labels (parameter.getAllValueStrings())
{
    attachment.sendInitialUpdate();
}

void ModeSwitch::paint (juce::Graphics& g)
{
    using namespace juce;

    const auto bounds = getLocalBounds().toFloat().reduced (0.5f);
    g.setColour (palette::panelRaised);
    g.fillRoundedRectangle (bounds, 6.0f);
    g.setColour (palette::outline);
    g.drawRoundedRectangle (bounds, 6.0f, 1.0f);

    const float segmentWidth = bounds.getWidth() / (float) jmax (1, labels.size());

    for (int i = 0; i < labels.size(); ++i)
    {
        const auto segment = Rectangle<float> (bounds.getX() + (float) i * segmentWidth, bounds.getY(), segmentWidth, bounds.getHeight());
        const bool on = i == selected;

        if (on)
        {
            g.setColour (palette::accent);
            g.fillRoundedRectangle (segment.reduced (2.0f), 4.5f);
        }

        g.setColour (on ? palette::background : palette::textDim);
        g.setFont (uiFont (12.5f, true));
        g.drawText (labels[i], segment, Justification::centred);
    }
}

void ModeSwitch::mouseDown (const juce::MouseEvent& event)
{
    const int index = juce::jlimit (0, labels.size() - 1, (int) (event.position.x / (float) getWidth() * (float) labels.size()));

    if (index != selected)
        attachment.setValueAsCompleteGesture ((float) index);
}
} // namespace snaptune
