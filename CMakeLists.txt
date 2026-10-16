cmake_minimum_required(VERSION 3.22)

set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS version")

if(NOT CMAKE_OSX_ARCHITECTURES)
    # Universal binary: native on Apple Silicon and also loadable when FL Studio runs under Rosetta.
    set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "Target architectures" FORCE)
endif()

project(SnapTune VERSION 1.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Use a local JUCE checkout if there is one, otherwise download the pinned release.
set(SNAPTUNE_JUCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/external/JUCE" CACHE PATH "Local JUCE checkout")

if(EXISTS "${SNAPTUNE_JUCE_DIR}/CMakeLists.txt")
    add_subdirectory("${SNAPTUNE_JUCE_DIR}" JUCE)
else()
    include(FetchContent)
    FetchContent_Declare(JUCE
        GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
        GIT_TAG 9.0.4
        GIT_SHALLOW TRUE)
    FetchContent_MakeAvailable(JUCE)
endif()

set(SNAPTUNE_SOURCES
    Source/dsp/PitchDetector.cpp
    Source/dsp/AutoTuneEngine.cpp
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/ui/SnapLookAndFeel.cpp
    Source/ui/PitchGraph.cpp
    Source/ui/ModeSwitch.cpp
    Source/ui/NotePills.cpp
    Source/ui/TunerGauge.cpp
    Source/ui/MainView.cpp)

juce_add_plugin(SnapTune
    COMPANY_NAME "Nico Fernandez"
    BUNDLE_ID "com.nicofernandez.snaptune"
    PLUGIN_MANUFACTURER_CODE Ncfz
    PLUGIN_CODE Snpt
    FORMATS VST3 AU Standalone
    PRODUCT_NAME "SnapTune"
    DESCRIPTION "Real-time pitch correction"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    VST3_CATEGORIES Fx "Pitch Shift"
    AU_MAIN_TYPE kAudioUnitType_MusicEffect
    COPY_PLUGIN_AFTER_BUILD TRUE
    MICROPHONE_PERMISSION_ENABLED TRUE
    MICROPHONE_PERMISSION_TEXT "SnapTune needs the microphone to tune your voice in real time."
    NEEDS_WEB_BROWSER FALSE
    NEEDS_CURL FALSE)

target_sources(SnapTune PRIVATE ${SNAPTUNE_SOURCES})
target_include_directories(SnapTune PRIVATE Source)

target_compile_definitions(SnapTune
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
        # Only note on/off is used for MIDI target notes; without this the VST3 wrapper adds
        # 2048 hidden "MIDI CC" parameters that clutter FL Studio's automation list.
        JUCE_VST3_EMULATE_MIDI_CC_WITH_PARAMETERS=0)

target_link_libraries(SnapTune
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags)

option(SNAPTUNE_BUILD_TESTS "Build the offline test runner" ON)

if(SNAPTUNE_BUILD_TESTS)
    juce_add_console_app(SnapTuneTests PRODUCT_NAME "SnapTuneTests")
    set_target_properties(SnapTuneTests PROPERTIES OSX_ARCHITECTURES "${CMAKE_HOST_SYSTEM_PROCESSOR}")

    target_sources(SnapTuneTests PRIVATE tests/TestMain.cpp ${SNAPTUNE_SOURCES})
    target_include_directories(SnapTuneTests PRIVATE Source)

    target_compile_definitions(SnapTuneTests
        PRIVATE
            JUCE_WEB_BROWSER=0
            JUCE_USE_CURL=0
            JUCE_PLUGINHOST_VST3=1
            JUCE_PLUGINHOST_AU=1
            JUCE_MODAL_LOOPS_PERMITTED=1)

    target_link_libraries(SnapTuneTests
        PRIVATE
            juce::juce_audio_utils
            juce::juce_dsp
        PUBLIC
            juce::juce_recommended_config_flags
            juce::juce_recommended_warning_flags)
endif()
