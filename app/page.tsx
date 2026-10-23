"use client";

import { useState } from "react";
import { GameControls } from "./components/GameControls";
import { GameHeader } from "./components/GameHeader";
import { GameViewport } from "./components/GameViewport";
import { InventoryShelf } from "./components/InventoryShelf";
import { PrestigeModal } from "./components/PrestigeModal";
import { StatsModal } from "./components/StatsModal";
import { WelcomeBackModal } from "./components/WelcomeBackModal";
import { useGameLogic } from "./hooks/useGameLogic";

export default function IdleForestGame() {
	const { state, stats, actions, offlineWelcomeData } = useGameLogic();
	const [showPrestigeModal, setShowPrestigeModal] = useState(false);
	const [showStatsModal, setShowStatsModal] = useState(false);

	const handlePrestigeClick = () => {
		actions.doPrestige();
		setShowPrestigeModal(false);
	};

	return (
		<div className="min-h-screen bg-brand-gray pt-4 pb-12 font-rethink-sans text-black overflow-x-hidden relative">
			<div className="container mx-auto px-4 max-w-7xl">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
					{/* Left Column: Game Viewport */}
					<div className="lg:col-span-8 flex flex-col gap-8">
						<GameHeader
							startTime={state.startTime}
							onOpenStats={() => setShowStatsModal(true)}
						/>

						<GameViewport
							state={state}
							stats={stats}
							onTreeClick={actions.clickTree}
							handlePrestigeClick={() => setShowPrestigeModal(true)}
							showPrestigeModal={showPrestigeModal}
							goldenAppleState={state.goldenApple}
							onAppleClick={actions.clickGoldenApple}
						>
							{offlineWelcomeData && (
								<WelcomeBackModal
									open={!!offlineWelcomeData}
									onClose={actions.clearOfflineWelcome}
									timeAway={offlineWelcomeData.timeAway}
									treesEarned={offlineWelcomeData.treesEarned}
								/>
							)}
						</GameViewport>

						<PrestigeModal
							open={showPrestigeModal}
							onClose={() => setShowPrestigeModal(false)}
							onPrestige={handlePrestigeClick}
							onBuyUpgrade={actions.buyPrestigeUpgrade}
							state={state}
						/>

						<StatsModal
							isOpen={showStatsModal}
							onClose={() => setShowStatsModal(false)}
							stats={state.stats}
							lifetimeTrees={state.lifetimeTrees}
							unlockedAchievements={state.unlockedAchievements}
						/>

						<InventoryShelf
							state={state}
							finalAutoBreakdown={stats.finalAutoBreakdown}
							finalAutoProduction={stats.finalAutoProduction}
						/>
					</div>

					{/* Right Column: Shop & Lab */}
					<div className="lg:col-span-4">
						<GameControls
							state={state}
							stats={stats}
							buyUpgrade={actions.buyUpgrade}
							buyTech={actions.buyTech}
							openPrestigeModal={() => setShowPrestigeModal(true)}
						/>
					</div>
				</div>
			</div>

			<style jsx global>{`
                .pixelated { image-rendering: pixelated; }
                .text-stroke-thin { -webkit-text-stroke: 1px black; }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #000; border-radius: 0; }
                ::-webkit-scrollbar-thumb:hover { background: #333; }
            `}</style>
		</div>
	);
}
