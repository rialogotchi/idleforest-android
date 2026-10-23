import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.idleforest.game",
	appName: "Idle Forest",
	webDir: "out",
	android: {
		allowMixedContent: false,
	},
	plugins: {
		CapacitorSQLite: {
			androidIsEncryption: false,
		},
	},
};

export default config;
