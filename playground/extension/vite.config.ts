import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import zip from "vite-plugin-zip-pack";
import pkg from "./package.json";

export default defineConfig({
	server: {
		port: 5173,
		strictPort: true,
		cors: {
			origin: [/chrome-extension:\/\//],
		},
	},
	plugins: [
		react(),
		crx({ manifest }),
		zip({
			outDir: "release",
			outFileName: `escape-from-home_${pkg.version}.zip`,
		}),
	],
});
