cmake_minimum_required(VERSION 3.22)

set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS version")

if(NOT CMAKE_OSX_ARCHITECTURES)
    # Universal binary: native on Apple Silicon and also loadable when FL Studio runs under Rosetta.
    set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "Target architectures" FORCE)
endif()

# Static MSVC runtime on Windows, so the plugin loads without the Visual C++ Redistributable installed.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

project(SnapTune VERSION 2.2.0 LANGUAGES C CXX)

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

# The version chip in the plugin window: "1.2" for 1.2.0, "1.2.1" for a patch, like the website.
if(PROJECT_VERSION_PATCH EQUAL 0)
    set(SNAPTUNE_DISPLAY_VERSION "${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}")
else()
    set(SNAPTUNE_DISPLAY_VERSION "${PROJECT_VERSION}")
endif()

set(SNAPTUNE_SOURCES
    Source/dsp/PitchDetector.cpp
    Source/dsp/AutoTuneEngine.cpp
    Source/PluginProcessor.cpp
    Source/Telemetry.cpp
    Source/UpdateCheck.cpp
    Source/PluginEditor.cpp
    Source/ui/SnapLookAndFeel.cpp
    Source/ui/PitchGraph.cpp
    Source/ui/ModeSwitch.cpp
    Source/ui/NotePills.cpp
    Source/ui/TunerGauge.cpp
    Source/ui/MainView.cpp)

# The brand's typefaces (SIL OFL, licences beside them in Source/fonts), compiled in so the window
# looks the same on every system.
juce_add_binary_data(SnapTuneFonts
    HEADER_NAME SnapTuneFonts.h
    NAMESPACE SnapTuneFonts
    SOURCES
        Source/fonts/Rokkitt-ExtraBold.ttf
        Source/fonts/Literata-Regular.ttf
        Source/fonts/Literata-SemiBold.ttf)
set_target_properties(SnapTuneFonts PROPERTIES POSITION_INDEPENDENT_CODE ON)

# Linux gets LV2, its own plugin format, where macOS gets the Audio Unit.
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    set(SNAPTUNE_FORMATS VST3 LV2 Standalone)
else()
    set(SNAPTUNE_FORMATS VST3 AU Standalone)
endif()

juce_add_plugin(SnapTune
    COMPANY_NAME "Nico Fernandez"
    BUNDLE_ID "com.nicofernandez.snaptune"
    PLUGIN_MANUFACTURER_CODE Ncfz
    PLUGIN_CODE Snpt
    FORMATS ${SNAPTUNE_FORMATS}
    PRODUCT_NAME "SnapTune"
    DESCRIPTION "Real-time pitch correction"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    VST3_CATEGORIES Fx "Pitch Shift"
    AU_MAIN_TYPE kAudioUnitType_MusicEffect
    # The LV2 plugin's identity in saved sessions: never change it.
    LV2URI "https://getsnaptune.com/lv2/snaptune"
    COPY_PLUGIN_AFTER_BUILD TRUE
    MICROPHONE_PERMISSION_ENABLED TRUE
    MICROPHONE_PERMISSION_TEXT "SnapTune needs the microphone to tune your voice in real time."
    NEEDS_WEB_BROWSER FALSE
    # Linux only: the usage ping needs libcurl for HTTPS (macOS and Windows use the system's own
    # networking). It's loaded at run time if the system has it (JUCE_LOAD_CURL_SYMBOLS_LAZILY), so
    # the plugin doesn't depend on it.
    NEEDS_CURL TRUE)

target_sources(SnapTune PRIVATE ${SNAPTUNE_SOURCES})
target_include_directories(SnapTune PRIVATE Source)

target_compile_definitions(SnapTune
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_LOAD_CURL_SYMBOLS_LAZILY=1
        JUCE_VST3_CAN_REPLACE_VST2=0
        # Anonymous usage pings for the website's admin panel (Source/Telemetry.h). Off in the tests.
        SNAPTUNE_TELEMETRY=1
        SNAPTUNE_DISPLAY_VERSION="${SNAPTUNE_DISPLAY_VERSION}"
        # Only note on/off is used for MIDI target notes; without this the VST3 wrapper adds
        # 2048 hidden "MIDI CC" parameters that clutter FL Studio's automation list.
        JUCE_VST3_EMULATE_MIDI_CC_WITH_PARAMETERS=0)

target_link_libraries(SnapTune
    PRIVATE
        SnapTuneFonts
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags)

# GCC checks every complex product for NaN (C99 Annex G), which slows down JUCE's own FFT, the one
# the pitch detector uses wherever there's no vDSP. SnapTune never multiplies infinities.
set(SNAPTUNE_GCC_OPTIONS $<$<CXX_COMPILER_ID:GNU>:-fcx-limited-range>)
target_compile_options(SnapTune PRIVATE ${SNAPTUNE_GCC_OPTIONS})

# Linux: carry the C++ runtime inside the plugin, so it loads whatever runtime the host brings, and
# drop libraries nothing calls (libcurl is opened at run time instead).
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    target_link_options(SnapTune PUBLIC -static-libstdc++ -static-libgcc LINKER:--as-needed)
endif()

option(SNAPTUNE_BUILD_TESTS "Build the offline test runner" ON)

if(SNAPTUNE_BUILD_TESTS)
    juce_add_console_app(SnapTuneTests PRODUCT_NAME "SnapTuneTests")
    set_target_properties(SnapTuneTests PROPERTIES OSX_ARCHITECTURES "${CMAKE_HOST_SYSTEM_PROCESSOR}")

    target_sources(SnapTuneTests PRIVATE tests/TestMain.cpp ${SNAPTUNE_SOURCES})
    target_include_directories(SnapTuneTests PRIVATE Source)
    target_compile_options(SnapTuneTests PRIVATE ${SNAPTUNE_GCC_OPTIONS})

    target_compile_definitions(SnapTuneTests
        PRIVATE
            JUCE_WEB_BROWSER=0
            JUCE_USE_CURL=0
            JUCE_PLUGINHOST_VST3=1
            JUCE_PLUGINHOST_AU=1
            $<$<PLATFORM_ID:Linux>:JUCE_PLUGINHOST_LV2=1>
            JUCE_MODAL_LOOPS_PERMITTED=1
            SNAPTUNE_DISPLAY_VERSION="${SNAPTUNE_DISPLAY_VERSION}")

    target_link_libraries(SnapTuneTests
        PRIVATE
            SnapTuneFonts
            juce::juce_audio_utils
            juce::juce_dsp
        PUBLIC
            juce::juce_recommended_config_flags
            juce::juce_recommended_warning_flags)
endif()
