#include "PluginEditor.h"

using snaptune::MainView;

namespace
{
const juce::Identifier uiScaleProperty ("uiScale");
}

SnapTuneEditor::SnapTuneEditor (SnapTuneProcessor& p)
    : AudioProcessorEditor (p), audioProcessor (p), view (p)
{
    // Reopen at the size the user left it (read before the resize limits trigger a first resize).
    const auto scale = juce::jlimit (0.7, 1.5, (double) audioProcessor.apvts.state.getProperty (uiScaleProperty, 1.0));

    setLookAndFeel (&lookAndFeel);
    addAndMakeVisible (view);

    setResizable (true, true);
    setResizeLimits (700, 448, 1500, 960);
    getConstrainer()->setFixedAspectRatio ((double) MainView::baseWidth / MainView::baseHeight);
    setSize (juce::roundToInt (MainView::baseWidth * scale), juce::roundToInt (MainView::baseHeight * scale));
    rememberSize = true;
}

SnapTuneEditor::~SnapTuneEditor()
{
    setLookAndFeel (nullptr);
}

void SnapTuneEditor::paint (juce::Graphics& g)
{
    g.fillAll (snaptune::palette::background);
}

void SnapTuneEditor::resized()
{
    const float scale = (float) getWidth() / (float) MainView::baseWidth;
    view.setBounds (0, 0, MainView::baseWidth, MainView::baseHeight);
    view.setTransform (juce::AffineTransform::scale (scale));

    if (rememberSize)
        audioProcessor.apvts.state.setProperty (uiScaleProperty, scale, nullptr);
}
