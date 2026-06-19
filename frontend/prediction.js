/**
 * =========================================================
 * LaundryFlow Cycle Simulation Engine
 * =========================================================
 * This module simulates appliance energy consumption cycles
 * for washing machines and dryers.
 *
 * Main responsibilities:
 * - Define appliance behavior profiles
 * - Generate synthetic measurement timelines
 * - Simulate phase-based energy consumption
 * - Predict cycle duration from partial data
 * - Provide sampling recommendations
 * =========================================================
 */

(function () {
    // =========================================================
    // APPLIANCE PROFILES CONFIGURATION
    // =========================================================

    /**
     * Static configuration describing supported appliances,
     * their program types, and expected energy/time ranges.
     */
    const APPLIANCE_PROFILES = {
        dryer: {
            label: "Dryer",
            recommendedSamplingIntervalSeconds: 10,
            programRanges: {
                normal: { minMinutes: 55, maxMinutes: 95, activeWatts: [1400, 2300], idleWatts: [20, 80] },
                eco: { minMinutes: 70, maxMinutes: 120, activeWatts: [1100, 1900], idleWatts: [15, 60] },
                intensive: { minMinutes: 85, maxMinutes: 140, activeWatts: [1700, 2600], idleWatts: [20, 90] }
            }
        },
        washer: {
            label: "Washing Machine",
            recommendedSamplingIntervalSeconds: 5,
            programRanges: {
                quick: { minMinutes: 25, maxMinutes: 45, activeWatts: [80, 1300], idleWatts: [5, 35] },
                normal: { minMinutes: 55, maxMinutes: 85, activeWatts: [120, 1800], idleWatts: [5, 40] },
                eco: { minMinutes: 80, maxMinutes: 120, activeWatts: [100, 1600], idleWatts: [5, 35] },
                intensive: { minMinutes: 95, maxMinutes: 140, activeWatts: [150, 2200], idleWatts: [5, 45] }
            }
        }
    };

    // =========================================================
    // UTILITY FUNCTIONS
    // =========================================================

    /** Clamp a value between min and max bounds */
    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    /** Generate a random integer between min and max (inclusive) */
    function randomInteger(min, max) {
        const lower = Math.ceil(min);
        const upper = Math.floor(max);
        return Math.floor(Math.random() * (upper - lower + 1)) + lower;
    }

    /** Generate a random float between min and max */
    function randomFloat(min, max) {
        return min + (Math.random() * (max - min));
    }

    // =========================================================
    // PROFILE RESOLUTION HELPERS
    // =========================================================

    /** Get appliance profile (fallback to washer if unknown type) */
    function getProfile(applianceType) {
        return APPLIANCE_PROFILES[applianceType] || APPLIANCE_PROFILES.washer;
    }

    /** Get program configuration for a given appliance + program name */
    function getProgramRange(applianceType, programName) {
        const profile = getProfile(applianceType);
        return profile.programRanges[programName] || profile.programRanges.normal || Object.values(profile.programRanges)[0];
    }

    /** Randomly select a program for a given appliance */
    function pickProgramName(applianceType) {
        const profile = getProfile(applianceType);
        const names = Object.keys(profile.programRanges);
        return names[randomInteger(0, names.length - 1)];
    }

    // =========================================================
    // PHASE SIMULATION ENGINE
    // =========================================================

    /**
     * Build a realistic phase-based execution plan
     * for a full appliance cycle.
     */
    function createPhasePlan(applianceType, totalMinutes, programName) {

        const isDryer = applianceType === "dryer";

        /** Phase structure depends on appliance type */
        const phaseNames = isDryer
            ? ["heating", "drying", "cooling", "idle"]
            : ["fill", "wash", "heat", "rinse", "spin", "idle"];

        /** Base duration distribution across phases */
        const baseShares = isDryer
            ? [0.15, 0.55, 0.18, 0.12]
            : [0.08, 0.34, 0.14, 0.2, 0.16, 0.08];

        const profileRange = getProgramRange(applianceType, programName);

        /** Apply randomness to total cycle duration */
        const durationJitter = randomFloat(0.85, 1.18);
        const targetMinutes = clamp(
            Math.round(totalMinutes * durationJitter),
            profileRange.minMinutes,
            profileRange.maxMinutes
        );

        const phases = [];
        let allocatedMinutes = 0;

        // Build each phase with randomized duration and power consumption
        phaseNames.forEach((phaseName, index) => {

            const isLast = index === phaseNames.length - 1;

            /** Add variability to phase duration distribution */
            const jitteredShare = clamp(baseShares[index] * randomFloat(0.75, 1.35), 0.04, 0.7);

            const phaseMinutes = isLast
                ? Math.max(1, targetMinutes - allocatedMinutes)
                : Math.max(1, Math.round(targetMinutes * jitteredShare));

            const wattsRange = phaseName === "idle"
                ? profileRange.idleWatts
                : profileRange.activeWatts;

            phases.push({
                name: phaseName,
                durationMinutes: phaseMinutes,
                powerWatts: randomInteger(wattsRange[0], wattsRange[1])
            });

            allocatedMinutes += phaseMinutes;
        });

        return {
            programName,
            totalMinutes: phases.reduce((sum, phase) => sum + phase.durationMinutes, 0),
            phases
        };
    }

    // =========================================================
    // MEASUREMENT TIMELINE GENERATION
    // =========================================================

    /**
     * Generate a full power consumption timeline
     * based on a simulated appliance cycle.
     */
    function buildMeasureTimeline(applianceType, programName, samplingIntervalSeconds) {

        const profile = getProfile(applianceType);

        const selectedProgramName = programName || pickProgramName(applianceType);

        const selectedRange = getProgramRange(applianceType, selectedProgramName);

        const totalMinutes = randomInteger(selectedRange.minMinutes, selectedRange.maxMinutes);

        const plan = createPhasePlan(applianceType, totalMinutes, selectedProgramName);

        const intervalSeconds = Math.max(
            1,
            Number(samplingIntervalSeconds) || profile.recommendedSamplingIntervalSeconds
        );

        const measurements = [];
        let elapsedMinutes = 0;

        // Generate per-phase samples
        plan.phases.forEach((phase, phaseIndex) => {

            const phaseDurationSeconds = phase.durationMinutes * 60;

            for (
                let elapsedSecondsInPhase = 0;
                elapsedSecondsInPhase < phaseDurationSeconds;
                elapsedSecondsInPhase += intervalSeconds
            ) {
                const powerFloor = phase.name === "idle"
                    ? Math.max(0, phase.powerWatts - 25)
                    : Math.max(0, phase.powerWatts - 120);

                const powerCeil = phase.name === "idle"
                    ? phase.powerWatts + 25
                    : phase.powerWatts + 160;

                measurements.push({
                    sampleIndex: measurements.length,
                    phaseIndex,
                    applianceType,
                    programName: selectedProgramName,
                    timestamp: new Date(
                        Date.now() +
                        ((elapsedMinutes * 60 + elapsedSecondsInPhase) * 1000)
                    ).toISOString(),
                    powerWatts: randomInteger(powerFloor, powerCeil)
                });
            }

            elapsedMinutes += phase.durationMinutes;
        });

        // Final shutdown sample
        measurements.push({
            sampleIndex: measurements.length,
            phaseIndex: plan.phases.length - 1,
            applianceType,
            programName: selectedProgramName,
            timestamp: new Date(Date.now() + (plan.totalMinutes * 60 * 1000)).toISOString(),
            powerWatts: 0
        });

        return {
            applianceType,
            applianceLabel: profile.label,
            programName: selectedProgramName,
            recommendedSamplingIntervalSeconds: intervalSeconds,
            totalMinutes: plan.totalMinutes,
            phases: plan.phases,
            measurements
        };
    }

    // =========================================================
    // PREDICTION ENGINE
    // =========================================================

    /**
     * Predict cycle duration and current phase
     * from partial power measurements.
     */
    function predictDurationFromMeasurements(
        measurements,
        applianceType = "washer",
        programName = "normal"
    ) {

        const profile = getProfile(applianceType);
        const selectedProgramRange = getProgramRange(applianceType, programName);

        const samples = Array.isArray(measurements)
            ? measurements.filter(item => Number.isFinite(item.powerWatts))
            : [];

        // Fallback if no data available
        if (!samples.length) {
            return {
                applianceType,
                applianceLabel: profile.label,
                programName,
                estimatedTotalMinutes: randomInteger(selectedProgramRange.minMinutes, selectedProgramRange.maxMinutes),
                estimatedRemainingMinutes: randomInteger(selectedProgramRange.minMinutes, selectedProgramRange.maxMinutes),
                phase: "unknown",
                confidence: 0
            };
        }

        const windowSize = Math.min(5, samples.length);
        const recentSamples = samples.slice(-windowSize);

        const averagePower =
            recentSamples.reduce((sum, sample) => sum + sample.powerWatts, 0) / recentSamples.length;

        const lastPower = recentSamples[recentSamples.length - 1].powerWatts;

        const powerTrend =
            recentSamples.length >= 2
                ? lastPower - recentSamples[0].powerWatts
                : 0;

        let phase = "unknown";

        let estimatedRemainingMinutes = randomInteger(
            Math.max(5, selectedProgramRange.minMinutes * 0.15),
            selectedProgramRange.maxMinutes
        );

        // Appliance-specific phase detection (dryer)
        if (applianceType === "dryer") {
            if (averagePower >= 1700) {
                phase = "heating";
                estimatedRemainingMinutes = randomInteger(18, 45);
            } else if (averagePower >= 1000) {
                phase = "drying";
                estimatedRemainingMinutes = randomInteger(10, 30);
            } else if (averagePower >= 300) {
                phase = "cooling";
                estimatedRemainingMinutes = randomInteger(3, 12);
            } else {
                phase = "idle";
                estimatedRemainingMinutes = randomInteger(0, 5);
            }
        }
        // Appliance-specific phase detection (washer)
        else {
            if (averagePower >= 1600) {
                phase = "heat";
                estimatedRemainingMinutes = randomInteger(20, 55);
            } else if (averagePower >= 800) {
                phase = "spin";
                estimatedRemainingMinutes = randomInteger(10, 25);
            } else if (averagePower >= 250) {
                phase = "wash";
                estimatedRemainingMinutes = randomInteger(15, 40);
            } else if (averagePower >= 80) {
                phase = "rinse";
                estimatedRemainingMinutes = randomInteger(8, 20);
            } else {
                phase = "idle";
                estimatedRemainingMinutes = randomInteger(0, 6);
            }
        }

        // Adjust prediction based on power trend
        if (powerTrend < -150) {
            estimatedRemainingMinutes = Math.max(0, estimatedRemainingMinutes - randomInteger(1, 5));
        } else if (powerTrend > 150) {
            estimatedRemainingMinutes += randomInteger(1, 5);
        }

        const estimatedTotalMinutes = clamp(
            samples.length + estimatedRemainingMinutes,
            selectedProgramRange.minMinutes,
            selectedProgramRange.maxMinutes
        );

        const confidence = clamp(
            0.35 +
            (windowSize / 10) +
            (Math.min(averagePower / 2200, 1) * 0.25),
            0,
            1
        );

        return {
            applianceType,
            applianceLabel: profile.label,
            programName,
            phase,
            estimatedTotalMinutes: Math.round(estimatedTotalMinutes),
            estimatedRemainingMinutes: Math.round(estimatedRemainingMinutes),
            averagePowerWatts: Math.round(averagePower),
            lastPowerWatts: Math.round(lastPower),
            confidence: Number(confidence.toFixed(2))
        };
    }

    // =========================================================
    // HIGH-LEVEL ESTIMATION HELPERS
    // =========================================================

    /**
     * Estimate default session duration based on early observations
     * and optional initial power reading.
     */
    function estimateDefaultSessionDurationMinutes(applianceType, observedPowerWatts = null) {

        const profile = getProfile(applianceType);
        const programName = pickProgramName(applianceType);

        const timeline = buildMeasureTimeline(
            applianceType,
            programName,
            profile.recommendedSamplingIntervalSeconds
        );

        const prediction = predictDurationFromMeasurements(
            timeline.measurements.slice(0, 8),
            applianceType,
            programName
        );

        let duration = prediction.estimatedTotalMinutes;

        if (Number.isFinite(observedPowerWatts)) {
            if (observedPowerWatts > 1600) {
                duration += randomInteger(2, 8);
            } else if (observedPowerWatts < 250) {
                duration -= randomInteger(1, 5);
            }
        }

        return clamp(Math.round(duration), 15, 180);
    }

    // =========================================================
    // PUBLIC API
    // =========================================================

    /** Get recommended sampling interval for an appliance type */
    function getRecommendedSamplingInterval(applianceType = "dryer") {
        return getProfile(applianceType).recommendedSamplingIntervalSeconds;
    }

    // Expose module globally
    window.LaundryFlowCycleLab = {
        profiles: APPLIANCE_PROFILES,
        buildMeasureTimeline,
        predictDurationFromMeasurements,
        estimateDefaultSessionDurationMinutes,
        getRecommendedSamplingInterval
    };

})();