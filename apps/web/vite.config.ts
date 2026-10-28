import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { mockApi } from "./mock-api.ts";

export default defineConfig({ plugins: [react(), tailwindcss(), mockApi()] });
