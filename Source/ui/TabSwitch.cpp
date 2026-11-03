#include "TabSwitch.h"
#include "SnapLookAndFeel.h"

namespace snaptune
{
TabSwitch::Tab::Tab (const juce::String& label)
    : juce::Button (label)
{
    setTitle (label);
    setRadioGroupId (2);
    setClickingTogglesState (true);
}

void TabSwitch::Tab::paintButton (juce::Graphics& g, bool highlighted, bool)
{
    using namespace juce;

    const auto bounds = getLocalBounds().toFloat();
    const bool on = getToggleState();
    const auto font = uiFont (13.5f, true);
    const float width = GlyphArrangement::getStringWidth (font, getButtonText());
    const float left = bounds.getX() + 2.0f;

    if (hasKeyboardFocus (false))
        drawFocusRing (g, bounds.reduced (1.0f), 4.0f);

    g.setColour (on || highlighted ? palette::text : palette::textDim);
    g.setFont (font);
    g.drawText (getButtonText(), bounds.withX (left), Justification::centredLeft);

    if (marked)
    {
        g.setColour (palette::accent);
        g.fillEllipse (Rectangle<float> (5.0f, 5.0f).withCentre ({ left + width + 7.0f, bounds.getCentreY() - 1.0f }));
    }

    if (on)
    {
        g.setColour (palette::accent);
        g.fillRect (Rectangle<float> (left, bounds.getCentreY() + 9.0f, width, 1.0f));
    }
}

TabSwitch::TabSwitch (const juce::StringArray& labels)
{
    for (int i = 0; i < labels.size(); ++i)
    {
        auto* tab = tabs.add (new Tab (labels[i]));
        tab->onClick = [this, i] { setSelectedIndex (i, juce::sendNotification); };
        addAndMakeVisible (tab);
    }

    if (auto* first = tabs[0])
        first->setToggleState (true, juce::dontSendNotification);
}

void TabSwitch::setSelectedIndex (int index, juce::NotificationType notification)
{
    index = juce::jlimit (0, juce::jmax (0, tabs.size() - 1), index);

    if (auto* tab = tabs[index])
        tab->setToggleState (true, juce::dontSendNotification);

    if (index == selected)
        return;

    selected = index;

    if (notification != juce::dontSendNotification && onChange)
        onChange (selected);
}

void TabSwitch::setMarked (int index, bool marked)
{
    if (auto* tab = tabs[index]; tab != nullptr && tab->marked != marked)
    {
        tab->marked = marked;
        tab->repaint();
    }
}

void TabSwitch::resized()
{
    // Each tab is as wide as its label, plus room for the dot and a gap before the next one.
    int x = 0;

    for (auto* tab : tabs)
    {
        const int width = juce::roundToInt (juce::GlyphArrangement::getStringWidth (uiFont (13.5f, true), tab->getButtonText())) + 30;
        tab->setBounds (x, 0, width, getHeight());
        x += width + 8;
    }
}
} // namespace snaptune
