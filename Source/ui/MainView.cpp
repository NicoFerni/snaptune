#include "MainView.h"
#include "../Parameters.h"
#include "../Presets.h"
#include "SnapLookAndFeel.h"

namespace snaptune
{
namespace
{
    // From project(VERSION) in CMakeLists.txt.
    constexpr const char* versionText = "v" SNAPTUNE_DISPLAY_VERSION;
    constexpr int margin = 20;

    // Knob order in `knobs`.
    enum KnobIndex
    {
        humanizeKnob,
        amountKnob,
        formantKnob,
        trackingKnob,
        mixKnob
    };
} // namespace

MainView::MainView (SnapTuneProcessor& p)
    : audioProcessor (p)
{
    setOpaque (true);
    scratch.resize (2048);

    juce::StringArray keys, scales;

    for (auto* name : noteNames)
        keys.add (name);

    for (auto* name : scaleNames)
        scales.add (name);

    // Header: presets and Studio/Live.
    presetBox.addSectionHeading ("Factory presets");

    for (int i = 0; i < numFactoryPresets; ++i)
        presetBox.addItem (factoryPresets[i].name, i + 1);

    presetBox.setTextWhenNothingSelected ("Presets");
    presetBox.setTitle ("Presets");
    presetBox.setTooltip ("Starting points for the correction knobs. Key, scale and voice are not changed.");
    presetBox.setHelpText (presetBox.getTooltip());
    presetBox.onChange = [this]
    {
        if (presetBox.getSelectedId() > 0)
            applyPreset (presetBox.getSelectedId() - 1);
    };
    addAndMakeVisible (presetBox);

    modeSwitch = std::make_unique<ModeSwitch> (*audioProcessor.apvts.getParameter (ids::mode));
    modeSwitch->setTooltip ("Studio: best quality, formants preserved, 46 ms (FL compensates it). "
                            "Live: about 3 ms, for hearing yourself tuned while you record.");
    addAndMakeVisible (*modeSwitch);

    updateButton.setTooltip ("A newer SnapTune is out. Click to open the download page; quit your DAW before installing it.");
    updateButton.onClick = [] { juce::URL ("https://getsnaptune.com/#install").launchInDefaultBrowser(); };
    addChildComponent (updateButton);
    updates->start();

    // Scale bar.
    setUpCombo (keyBox, "Key", keys, ids::key, keyAttachment, "The key of the song.");
    setUpCombo (scaleBox, "Scale", scales, ids::scale, scaleAttachment, "Which notes the voice may land on. Pick Chromatic if you don't know the key.");

    pills.setTooltip ("Lit notes are in the scale; the solid one is being tuned to right now. Click to add or remove a note (switches to Custom).");
    pills.onToggle = [this] (int pc) { toggleNote (pc); };
    addAndMakeVisible (pills);

    midiButton.setTooltip ("Tune to the notes held on the MIDI input instead of the scale (e.g. from FL's piano roll via a MIDI Out channel).");
    midiButton.setHelpText (midiButton.getTooltip());
    addAndMakeVisible (midiButton);
    midiAttachment = std::make_unique<ButtonAttachment> (audioProcessor.apvts, ids::midi, midiButton);

    // Hero: tuner and retune speed.
    gauge.setTitle ("Tuner");
    gauge.setTooltip ("Sage: what you sang. Gold: what comes out. Centre: the note it is tuning to.");
    gauge.setHelpText (gauge.getTooltip());
    addAndMakeVisible (gauge);

    retuneKnob.getProperties().set ("hero", true);
    retuneKnob.getProperties().set ("startLabel", "Fast");
    retuneKnob.getProperties().set ("endLabel", "Slow");
    setUpKnob (retuneKnob, "Retune Speed", ids::retune, retuneAttachment, 20.0,
               "How fast the voice is pulled onto the note. 0 ms is the hard, robotic snap; slower keeps slides and vibrato.");

    // Pitch graph.
    graph.setFramesPerSecond (audioProcessor.engine.getFramesPerSecond());
    graph.setTitle ("Pitch graph");
    graph.setTooltip ("Scroll or drag to move the note range (it then stays put). Double-click to follow the singer again.");
    graph.setHelpText ("Dashed sage: what you sang. Solid gold: what comes out.");
    addAndMakeVisible (graph);

    // Controls.
    addKnob (ids::humanize, "Humanize", false, 0.0, "Relaxes the correction on long notes so they keep their natural movement.");
    addKnob (ids::amount, "Amount", false, 100.0, "How much of the pitch error is corrected.");
    addKnob (ids::formant, "Formant", true, 0.0, "Moves the character of the voice up (smaller) or down (bigger) without changing pitch. Studio mode only.");
    addKnob (ids::tracking, "Tracking", false, 50.0, "Higher treats breathy or noisy singing as pitched; lower is stricter.");
    addKnob (ids::mix, "Mix", false, 100.0, "Blend of the original and the tuned voice.");

    setUpCombo (voiceBox, "Voice", voiceTypeNames, ids::voice, voiceAttachment, "The range the pitch detector listens in. Pick Low Male for deep voices.");

    // Discard frames that piled up while the editor was closed.
    while (audioProcessor.engine.popFrames (scratch.data(), (int) scratch.size()) > 0)
    {
    }

    setSize (baseWidth, baseHeight);
    refreshState();
    startTimerHz (60);
}

MainView::~MainView()
{
    stopTimer();
}

void MainView::setUpCombo (juce::ComboBox& box, const juce::String& title, const juce::StringArray& items, const char* parameterId,
                           std::unique_ptr<ComboBoxAttachment>& attachment, const juce::String& tooltip)
{
    box.addItemList (items, 1);
    box.setJustificationType (juce::Justification::centredLeft);
    box.setTitle (title);
    box.setTooltip (tooltip);
    box.setHelpText (tooltip);
    addAndMakeVisible (box);
    attachment = std::make_unique<ComboBoxAttachment> (audioProcessor.apvts, parameterId, box);
}

void MainView::setUpKnob (juce::Slider& slider, const juce::String& title, const char* parameterId,
                          std::unique_ptr<SliderAttachment>& attachment, double resetValue, const juce::String& tooltip)
{
    slider.setTitle (title);
    slider.setHelpText (tooltip);
    slider.setWantsKeyboardFocus (true);
    slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    slider.setTextBoxStyle (juce::Slider::NoTextBox, false, 0, 0);
    slider.setRotaryParameters (juce::MathConstants<float>::pi * 1.25f, juce::MathConstants<float>::pi * 2.75f, true);
    slider.setMouseDragSensitivity (240);
    slider.setTooltip (tooltip);
    addAndMakeVisible (slider);

    attachment = std::make_unique<SliderAttachment> (audioProcessor.apvts, parameterId, slider);
    slider.setDoubleClickReturnValue (true, resetValue);
}

void MainView::addKnob (const char* parameterId, const juce::String& title, bool bipolar, double resetValue, const juce::String& tooltip)
{
    auto knob = std::make_unique<Knob>();
    knob->caption = title;
    knob->slider.getProperties().set ("bipolar", bipolar);
    setUpKnob (knob->slider, title, parameterId, knob->attachment, resetValue, tooltip);
    knobs.push_back (std::move (knob));
}

//==============================================================================
void MainView::resized()
{
    header = { margin, 12, baseWidth - 2 * margin, 44 };
    presetBox.setBounds (232, 19, 196, 30);
    modeSwitch->setBounds (header.getRight() - 150, 19, 150, 30);
    latencyArea = { modeSwitch->getX() - 140, 14, 128, 40 };
    updateButton.setBounds (presetBox.getRight() + 16, 21, updateButton.getWidth(), 26);

    scaleBar = { margin, 66, baseWidth - 2 * margin, 64 };
    keyBox.setBounds (scaleBar.getX() + 16, scaleBar.getY() + 26, 70, 30);
    scaleBox.setBounds (keyBox.getRight() + 12, keyBox.getY(), 168, 30);
    midiButton.setBounds (scaleBar.getRight() - 16 - 118, keyBox.getY(), 118, 30);
    pills.setBounds (scaleBox.getRight() + 24, keyBox.getY(), midiButton.getX() - 28 - (scaleBox.getRight() + 24), 30);

    heroPanel = { margin, 142, 310, 328 };
    gauge.setBounds (heroPanel.getX() + 10, heroPanel.getY() + 8, heroPanel.getWidth() - 20, 164);
    retuneKnob.setBounds (heroPanel.getCentreX() - 90, heroPanel.getY() + 196, 180, 128);

    graphPanel = { heroPanel.getRight() + 12, heroPanel.getY(), baseWidth - margin - (heroPanel.getRight() + 12), heroPanel.getHeight() };
    graph.setBounds (graphPanel.reduced (1));

    controlsPanel = { margin, heroPanel.getBottom() + 12, baseWidth - 2 * margin, 138 };
    auto cells = controlsPanel.reduced (16, 0);
    const int cellWidth = 150;

    for (auto& knob : knobs)
        knob->slider.setBounds (cells.removeFromLeft (cellWidth).withTrimmedTop (34).withTrimmedBottom (12).withSizeKeepingCentre (84, 92));

    cells.removeFromLeft (24);
    voiceBox.setBounds (cells.getX(), controlsPanel.getY() + 56, cells.getWidth(), 30);
}

void MainView::paint (juce::Graphics& g)
{
    using namespace juce;

    g.fillAll (palette::background);

    // Header: mark, wordmark, version.
    drawLogo (g, Rectangle<float> ((float) header.getX(), 19.0f, 30.0f, 30.0f));
    const auto wordmarkFont = displayFont (27.0f);
    const float wordmarkWidth = GlyphArrangement::getStringWidth (wordmarkFont, "SNAPTUNE");
    g.setColour (palette::accent);
    g.setFont (wordmarkFont);
    g.drawText ("SNAPTUNE", Rectangle<float> ((float) header.getX() + 42.0f, 18.0f, wordmarkWidth + 4.0f, 32.0f), Justification::centredLeft);

    g.setColour (palette::textDim);
    g.setFont (labelFont());
    g.drawText (versionText, Rectangle<float> ((float) header.getX() + 42.0f + wordmarkWidth + 10.0f, 26.0f, 40.0f, 19.0f),
                Justification::centredLeft);

    // Latency readout next to the mode switch.
    const double sampleRate = audioProcessor.getSampleRate();
    g.setFont (labelFont());
    g.setColour (palette::textDim);
    g.drawText ("Latency", latencyArea.withHeight (16).translated (0, 3), Justification::centredRight);
    g.setFont (uiFont (15.0f, true));
    g.setColour (palette::text);
    g.drawText (sampleRate > 0.0 ? String (1000.0 * audioProcessor.engine.getLatencySamples() / sampleRate, 1) + " ms" : String ("--"),
                latencyArea.withTrimmedTop (20), Justification::centredRight);

    // Panels.
    for (auto panel : { scaleBar, heroPanel, graphPanel, controlsPanel })
        drawPanel (g, panel.toFloat());

    g.setFont (labelFont());
    g.setColour (palette::textDim);

    auto captionAbove = [&] (const Component& c, const String& text, Justification just = Justification::centredLeft)
    { g.drawText (text, c.getX() + 2, c.getY() - 20, jmax (c.getWidth(), 100), 16, just); };

    captionAbove (keyBox, "Key");
    captionAbove (scaleBox, "Scale");
    captionAbove (pills, "Scale notes");
    captionAbove (midiButton, "Target");

    // Hero caption.
    g.drawText ("Retune speed", Rectangle<int> (heroPanel.getX(), retuneKnob.getY() - 18, heroPanel.getWidth(), 16), Justification::centred);

    // Control captions.
    for (auto& knob : knobs)
    {
        const bool enabled = knob->slider.isEnabled();
        g.setColour (enabled ? palette::textDim : palette::textFaint);
        g.drawText (enabled ? knob->caption : knob->caption + " (Studio only)", knob->slider.getX() - 40, controlsPanel.getY() + 17,
                    knob->slider.getWidth() + 80, 16, Justification::centred);
    }

    // Divider and the voice selector.
    const float dividerX = (float) voiceBox.getX() - 14.0f;
    g.setColour (palette::line);
    g.fillRect (Rectangle<float> (dividerX, (float) controlsPanel.getY() + 18.0f, 1.0f, (float) controlsPanel.getHeight() - 36.0f));

    g.setColour (palette::textDim);
    g.drawText ("Voice", voiceBox.getX() + 2, controlsPanel.getY() + 17, voiceBox.getWidth(), 16, Justification::centredLeft);
    g.setFont (uiFont (11.5f));
    g.drawFittedText ("Pitch range the detector\nlistens for", voiceBox.getX() + 2, voiceBox.getBottom() + 8, voiceBox.getWidth(), 30,
                      Justification::topLeft, 2);
}

//==============================================================================
void MainView::timerCallback()
{
    const int count = audioProcessor.engine.popFrames (scratch.data(), (int) scratch.size());
    consumeFrames (scratch.data(), count);
    refreshState();

    if (--updateCheckCountdown <= 0)
    {
        updateCheckCountdown = 60;
        showUpdateIfAny();
    }
}

void MainView::showUpdateIfAny()
{
    const auto newer = updates->getNewerVersion();

    if (newer.isEmpty() || updateButton.isVisible())
        return;

    const auto shown = newer.endsWith (".0") ? newer.dropLastCharacters (2) : newer;
    updateButton.setButtonText ("SnapTune " + shown + " is out");
    updateButton.setTitle (updateButton.getButtonText() + ": open the download page");

    // Sized to its words, and never into the latency readout.
    const float textWidth = juce::GlyphArrangement::getStringWidth (uiFont (13.0f, true), updateButton.getButtonText());
    updateButton.setSize (juce::jmin (latencyArea.getX() - 16 - updateButton.getX(), juce::roundToInt (textWidth) + 40), 26);
    updateButton.setVisible (true);
}

void MainView::UpdateButton::paintButton (juce::Graphics& g, bool highlighted, bool down)
{
    using namespace juce;

    const auto font = uiFont (13.0f, true);
    const auto pill = getLocalBounds().toFloat().reduced (0.5f);

    g.setColour (palette::accent.withAlpha (down ? 0.32f : highlighted ? 0.22f : 0.12f));
    g.fillRoundedRectangle (pill, pill.getHeight() / 2.0f);
    g.setColour (palette::accent);
    g.drawRoundedRectangle (pill, pill.getHeight() / 2.0f, 1.0f);

    // A small arrow up and out: it opens the browser.
    const auto arrow = Rectangle<float> (pill.getRight() - 22.0f, pill.getCentreY() - 4.0f, 8.0f, 8.0f);
    Path p;
    p.startNewSubPath (arrow.getBottomLeft());
    p.lineTo (arrow.getTopRight());
    p.startNewSubPath (arrow.getX() + 2.5f, arrow.getY());
    p.lineTo (arrow.getTopRight());
    p.lineTo (arrow.getRight(), arrow.getY() + 5.5f);
    g.strokePath (p, PathStrokeType (1.4f));

    g.setFont (font);
    g.drawText (getButtonText(), pill.withTrimmedLeft (14.0f).withTrimmedRight (26.0f), Justification::centredLeft);
}

void MainView::injectFrames (const PitchFrame* frames, int count)
{
    consumeFrames (frames, count);
    refreshState();

    // The snapshot has no timer running, so settle the animation immediately.
    for (int i = 0; i < 40; ++i)
        gauge.animate();
}

void MainView::consumeFrames (const PitchFrame* frames, int count)
{
    for (int i = 0; i < count; ++i)
    {
        if (frames[i].voiced)
        {
            lastVoiced = frames[i];
            framesSinceVoiced = 0;
        }
        else
        {
            ++framesSinceVoiced;
        }
    }

    graph.setAllowedMask (allowedMask());

    if (count > 0)
        graph.pushFrames (frames, count);
}

void MainView::refreshState()
{
    const bool singing = framesSinceVoiced < (int) (audioProcessor.engine.getFramesPerSecond() * 0.3);
    const int target = lastVoiced.targetNote >= 0 ? lastVoiced.targetNote : (int) std::lround (lastVoiced.inputNote);

    pills.setState (allowedMask(), audioProcessor.engine.getHeldNoteMask(), singing && lastVoiced.targetNote >= 0 ? pitchClass (target) : -1);
    gauge.setState (singing, target, (lastVoiced.inputNote - (float) target) * 100.0f, (lastVoiced.outputNote - (float) target) * 100.0f);
    gauge.animate();

    // Where the graph sits before anything is sung: the middle of the selected voice range.
    static constexpr int homeNotes[] = { 69, 57, 48, 60 }; // soprano A4, alto/tenor A3, low male C3, instrument C4
    graph.setHomeNote (homeNotes[juce::jlimit (0, 3, (int) audioProcessor.readSettings().voice)]);

    // Live mode reads the input directly, so there are no grains to move the formants with.
    const int mode = modeSwitch->getSelectedIndex();

    if (mode != shownMode)
    {
        shownMode = mode;
        auto& formant = knobs[formantKnob]->slider;
        formant.setEnabled (mode == 0);
        formant.setAlpha (mode == 0 ? 1.0f : 0.35f);
        repaint (controlsPanel);
    }

    if (audioProcessor.engine.getLatencySamples() != shownLatency)
    {
        shownLatency = audioProcessor.engine.getLatencySamples();
        repaint (latencyArea);
    }

    if (--presetCheckCountdown <= 0)
    {
        presetCheckCountdown = 15;
        const int match = matchingPreset();

        if (presetBox.getSelectedId() != match + 1)
            presetBox.setSelectedId (match + 1, juce::dontSendNotification);
    }
}

//==============================================================================
uint16_t MainView::allowedMask() const
{
    const auto settings = audioProcessor.readSettings();
    const auto held = audioProcessor.engine.getHeldNoteMask();

    if (settings.midiTargets && held != 0)
        return held;

    return pitchClassMask (settings.key, settings.scale, settings.customMask);
}

void MainView::toggleNote (int pc)
{
    const auto settings = audioProcessor.readSettings();
    auto mask = pitchClassMask (settings.key, settings.scale, settings.customMask);
    mask = (uint16_t) (mask ^ (1u << pc));

    for (int i = 0; i < 12; ++i)
        setParameter (ids::note (i), ((mask >> i) & 1u) != 0 ? 1.0f : 0.0f);

    setParameter (ids::scale, (float) Scale::custom);
}

float MainView::plainValue (const char* id) const
{
    return audioProcessor.apvts.getRawParameterValue (id)->load();
}

int MainView::matchingPreset() const
{
    for (int i = 0; i < numFactoryPresets; ++i)
    {
        const auto& p = factoryPresets[i];
        const bool same = std::abs (plainValue (ids::retune) - p.retune) < 0.05f && std::abs (plainValue (ids::humanize) - p.humanize) < 0.05f
                          && std::abs (plainValue (ids::amount) - p.amount) < 0.05f && std::abs (plainValue (ids::formant) - p.formant) < 0.005f
                          && std::abs (plainValue (ids::tracking) - p.tracking) < 0.05f && std::abs (plainValue (ids::mix) - p.mix) < 0.05f;

        if (same)
            return i;
    }

    return -1;
}

void MainView::applyPreset (int index)
{
    if (index < 0 || index >= numFactoryPresets)
        return;

    const auto& p = factoryPresets[index];
    setParameter (ids::retune, p.retune);
    setParameter (ids::humanize, p.humanize);
    setParameter (ids::amount, p.amount);
    setParameter (ids::formant, p.formant);
    setParameter (ids::tracking, p.tracking);
    setParameter (ids::mix, p.mix);
}

void MainView::setParameter (const juce::String& id, float value)
{
    if (auto* parameter = audioProcessor.apvts.getParameter (id))
    {
        const float normalised = parameter->convertTo0to1 (value);

        if (std::abs (parameter->getValue() - normalised) < 1.0e-6f)
            return;

        parameter->beginChangeGesture();
        parameter->setValueNotifyingHost (normalised);
        parameter->endChangeGesture();
    }
}
} // namespace snaptune
