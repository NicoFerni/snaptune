#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

namespace snaptune
{
/** Pages of a panel, as a row of labels with the gold line under the open one (the look of the
    Studio / Live switch). A page can carry a dot, to show something on it is switched on. */
class TabSwitch final : public juce::Component
{
public:
    explicit TabSwitch (const juce::StringArray& labels);

    int getSelectedIndex() const noexcept { return selected; }
    void setSelectedIndex (int index, juce::NotificationType);

    /** Shows a small gold dot after the label of `index`. */
    void setMarked (int index, bool marked);

    std::function<void (int)> onChange;

    void resized() override;

private:
    struct Tab final : public juce::Button
    {
        explicit Tab (const juce::String& label);
        void paintButton (juce::Graphics&, bool highlighted, bool down) override;
        bool marked = false;
    };

    juce::OwnedArray<Tab> tabs;
    int selected = 0;
};
} // namespace snaptune
