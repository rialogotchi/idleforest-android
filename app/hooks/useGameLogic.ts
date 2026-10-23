import {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { App as CapApp } from "@capacitor/app";
import { dbGet, dbSet } from "@/lib/db";
import { ACHIEVEMENTS, type GoldenAppleType } from "../data";
import { GameState, gameReducer, INITIAL_STATE } from "../reducer";

export function useGameLogic() {
	const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

	// Offline Welcome State
	const [offlineWelcomeData, setOfflineWelcomeData] = useState<{
		timeAway: number;
		treesEarned: number;
	} | null>(null);

	// Derived Stats - Advanced Calculation with Techs & Lab Multipliers
	const stats = useMemo(() => {
		const upgradeMultipliers: Record<string, number> = {};
		let techGlobalClickMult = 1;
		let techGlobalProductionMult = 1;

		state.upgrades
			.filter((u) => u.type === "multiplier")
			.forEach((labItem) => {
				if (
					labItem.level > 0 &&
					labItem.targetUpgradeId &&
					labItem.multiplierSignal
				) {
					if (labItem.targetUpgradeId === "ALL_GLOBAL") {
						techGlobalProductionMult *=
							1 + labItem.multiplierSignal * labItem.level;
					} else if (labItem.targetUpgradeId === "ALL_CLICK") {
						techGlobalClickMult *= 1 + labItem.multiplierSignal * labItem.level;
					} else {
						const bonus = 1 + labItem.multiplierSignal * labItem.level;
						upgradeMultipliers[labItem.targetUpgradeId] =
							(upgradeMultipliers[labItem.targetUpgradeId] || 1) * bonus;
					}
				}
			});

		const baseClickPercent = 0.05; // Base: 5% of TPS
		let baseAutoTotal = 0;
		const autoBreakdown: Record<string, number> = {};

		state.upgrades.forEach((u) => {
			if (u.level === 0) return;
			const specificMult = upgradeMultipliers[u.id] || 1;
			if (u.autoSignal) {
				const itemProd = u.autoSignal * u.level * specificMult;
				autoBreakdown[u.id] = itemProd;
				baseAutoTotal += itemProd;
			}
		});

		return {
			baseClickPercent,
			baseAutoTotal,
			autoBreakdown,
			techGlobalClickMult,
			techGlobalProductionMult,
			upgradeMultipliers,
		};
	}, [state.upgrades, state.techs]);

	// Final Calculation formula
	const goldenSeedMult = 1 + (state.goldenSeeds || 0) * 0.1;
	const sapMult = 1 + (state.unlockedAchievements?.length || 0) * 0.02;

	const buffsProductionMult = state.activeMultipliers
		.filter((m) => m.type === "production")
		.reduce((acc, curr) => acc * curr.value, 1);

	const buffsClickMult = state.activeMultipliers
		.filter((m) => m.type === "click")
		.reduce((acc, curr) => acc * curr.value, 1);

	const totalProductivityMultiplier =
		stats.techGlobalProductionMult *
		goldenSeedMult *
		sapMult *
		buffsProductionMult;

	const finalAutoProduction = Math.max(
		0,
		stats.baseAutoTotal * totalProductivityMultiplier,
	);

	// Ensure clicking is always at least 1, even with 0 TPS
	const finalClickPower =
		(1 + finalAutoProduction * stats.baseClickPercent) *
		stats.techGlobalClickMult *
		buffsClickMult;

	const finalAutoBreakdown = useMemo(() => {
		const bd: Record<string, number> = {};
		Object.entries(stats.autoBreakdown).forEach(([id, val]) => {
			bd[id] = val * totalProductivityMultiplier;
		});
		return bd;
	}, [stats.autoBreakdown, totalProductivityMultiplier]);

	const itemProductionRates = useMemo(() => {
		const rates: Record<string, number> = {};
		state.upgrades.forEach((u) => {
			if (u.type === "auto" && u.autoSignal) {
				const specificMult = stats.upgradeMultipliers[u.id] || 1;
				rates[u.id] = u.autoSignal * specificMult * totalProductivityMultiplier;
			}
		});
		return rates;
	}, [state.upgrades, stats.upgradeMultipliers, totalProductivityMultiplier]);

	// Save Game Version to force resets when needed
	const CURRENT_SAVE_VERSION = 2;
	const DB_KEY = "gamesave";
	// Veritabanına yazma aralığı (istenen aralık: 5-30 sn)
	const SAVE_INTERVAL_MS = 10_000;

	// Load Game on Mount (from local SQLite database)
	useEffect(() => {
		let cancelled = false;
		(async () => {
			let payload: any = { version: CURRENT_SAVE_VERSION };
			try {
				const raw = await dbGet(DB_KEY);
				if (raw) {
					const parsed = JSON.parse(raw);
					if (parsed.version === CURRENT_SAVE_VERSION) payload = parsed;
				}
			} catch (e) {
				console.error("Load failed, starting fresh", e);
			}
			if (!cancelled) dispatch({ type: "LOAD_GAME", payload });
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Offline Welcome (once after load)
	const hasCheckedOffline = useRef(false);
	useEffect(() => {
		if (!state.loaded || hasCheckedOffline.current) return;
		hasCheckedOffline.current = true;

		const now = Date.now();
		const lastSave = state.lastSaveTime || now;
		const diffMS = now - lastSave;

		if (diffMS > 60000) {
			const diffSeconds = Math.min(diffMS / 1000, 86400); // Max 24h
			const efficiency = 0.5;
			const earned = Math.floor(diffSeconds * finalAutoProduction * efficiency);
			if (earned > 0) {
				setOfflineWelcomeData({ timeAway: diffSeconds, treesEarned: earned });
			}
		}
	}, [state.loaded, state.lastSaveTime, finalAutoProduction]);

	const clearOfflineWelcome = useCallback(() => {
		if (offlineWelcomeData) {
			dispatch({
				type: "ADD_OFFLINE_TREES",
				payload: offlineWelcomeData.treesEarned,
			});
			setOfflineWelcomeData(null);
		}
	}, [offlineWelcomeData]);

	// State Ref for saving (reads latest state without re-creating timers)
	const stateRef = useRef(state);
	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	// Save everything to the local database
	const saveInternal = useCallback(async () => {
		const currentState = stateRef.current;
		if (!currentState.loaded) return;

		const now = Date.now();
		const save = {
			trees: currentState.trees,
			lifetimeTrees: currentState.lifetimeTrees,
			upgrades: currentState.upgrades,
			itemLifetimeProduction: currentState.itemLifetimeProduction,
			techs: currentState.techs,
			goldenSeeds: currentState.goldenSeeds,
			prestigeCount: currentState.prestigeCount,
			prestigeUpgrades: currentState.prestigeUpgrades,
			unlockedAchievements: currentState.unlockedAchievements,
			startTime: currentState.startTime,
			lastSaveTime: now,
			stats: currentState.stats,
			version: CURRENT_SAVE_VERSION,
		};
		await dbSet(DB_KEY, JSON.stringify(save));
	}, []);

	// Periodic save (every SAVE_INTERVAL_MS) + flush when the app goes to background
	useEffect(() => {
		const interval = setInterval(saveInternal, SAVE_INTERVAL_MS);

		const handleVisibility = () => {
			if (document.visibilityState === "hidden") saveInternal();
		};
		document.addEventListener("visibilitychange", handleVisibility);

		const pauseListener = CapApp.addListener("pause", () => {
			saveInternal();
		});

		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", handleVisibility);
			pauseListener.then((h) => h.remove()).catch(() => {});
		};
	}, [saveInternal]);

	// Game Loop (rAF)
	useEffect(() => {
		if (finalAutoProduction === 0) return;

		let lastTime = Date.now();
		let frameId: number;

		const loop = () => {
			const now = Date.now();
			const rawDt = (now - lastTime) / 1000;
			lastTime = now;

			if (rawDt > 0) {
				const breakdownForTick: Record<string, number> = {};
				Object.entries(finalAutoBreakdown).forEach(([id, val]) => {
					breakdownForTick[id] = val * rawDt;
				});

				dispatch({
					type: "AUTO_TICK",
					payload: {
						total: finalAutoProduction * rawDt,
						breakdown: breakdownForTick,
						dt: rawDt,
					},
				});
			}
			frameId = requestAnimationFrame(loop);
		};

		frameId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frameId);
	}, [finalAutoProduction, finalAutoBreakdown]);

	// Action Handlers
	const clickTree = useCallback(() => {
		dispatch({ type: "CLICK_TREE", payload: finalClickPower });
	}, [finalClickPower]);

	const buyUpgrade = useCallback((upgradeId: string, amount: number) => {
		dispatch({ type: "BUY_UPGRADE", payload: { id: upgradeId, amount } });
	}, []);

	const buyTech = useCallback((techId: string) => {
		dispatch({ type: "BUY_TECH", payload: techId });
	}, []);

	const doPrestige = useCallback(() => {
		dispatch({ type: "PRESTIGE", payload: null });
	}, []);

	const clickGoldenApple = useCallback(() => {
		dispatch({ type: "CLICK_GOLDEN_APPLE", payload: null });
	}, []);

	// --- SYSTEMS ---

	// 1. ACHIVEMENT CHECKER
	useEffect(() => {
		const checkAchievements = () => {
			ACHIEVEMENTS.forEach((ach) => {
				let unlocked = false;
				if (state.unlockedAchievements.includes(ach.id)) return;

				switch (ach.conditionType) {
					case "click_total":
						if (state.stats.totalManualClicks >= ach.threshold) unlocked = true;
						break;
					case "trees_lifetime":
						if (state.lifetimeTrees >= ach.threshold) unlocked = true;
						break;
				}

				if (unlocked) {
					dispatch({ type: "UNLOCK_ACHIEVEMENT", payload: ach.id });
				}
			});
		};
		const interval = setInterval(checkAchievements, 2000);
		return () => clearInterval(interval);
	}, [
		state.stats.totalManualClicks,
		state.lifetimeTrees,
		state.unlockedAchievements,
	]);

	// 2. GOLDEN APPLE SPAWNER
	useEffect(() => {
		if (state.goldenApple.active) return;

		const interval = setInterval(() => {
			const appleMagnetLevel =
				state.prestigeUpgrades?.find((u) => u.id === "apple_magnet")?.level ||
				0;
			const magnetBonus = appleMagnetLevel * 0.2;

			const baseChance =
				(0.01 + Math.min((state.goldenSeeds || 0) * 0.01, 0.25)) *
				(1 + magnetBonus);

			if (Math.random() < baseChance) {
				const type: GoldenAppleType = Math.random() > 0.7 ? "chain" : "frenzy";
				dispatch({
					type: "SPAWN_GOLDEN_APPLE",
					payload: {
						type,
						x: 10 + Math.random() * 80,
						y: 20 + Math.random() * 60,
					},
				});
			}
		}, 10000);
		return () => clearInterval(interval);
	}, [state.goldenApple.active, state.goldenSeeds]);

	// 2.5 GOLDEN APPLE DESPAWNER
	useEffect(() => {
		if (!state.goldenApple.active) return;
		const timer = setTimeout(() => {
			dispatch({ type: "DESPAWN_GOLDEN_APPLE", payload: null });
		}, 20000);
		return () => clearTimeout(timer);
	}, [state.goldenApple.active]);

	// 3. BUFF EXPIRATION CHECKER
	useEffect(() => {
		if (state.activeMultipliers.length === 0) return;
		const interval = setInterval(() => {
			dispatch({ type: "REMOVE_EXPIRED_EFFECTS", payload: Date.now() });
		}, 1000);
		return () => clearInterval(interval);
	}, [state.activeMultipliers.length]);

	return {
		state,
		stats: {
			baseClickPercent: stats.baseClickPercent,
			techGlobalClickMult: stats.techGlobalClickMult,
			finalAutoProduction,
			finalClickPower,
			finalAutoBreakdown,
			itemProductionRates,
		},
		actions: {
			clickTree,
			buyUpgrade,
			buyTech,
			doPrestige,
			buyPrestigeUpgrade: (id: string) =>
				dispatch({ type: "BUY_PRESTIGE_UPGRADE", payload: id }),
			clearOfflineWelcome,
			clickGoldenApple,
		},
		offlineWelcomeData,
	};
}
