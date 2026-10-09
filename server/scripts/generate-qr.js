import bwipjs from "bwip-js";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const expoUrl = "exp://192.168.1.20:8081";
const png = await bwipjs.toBuffer({
  bcid: "qrcode",
  text: expoUrl,
  scale: 6,
  height: 30,
  width: 30,
});

const targetPath = "C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\9820123a-fc1c-419a-8603-c3fff671da83\\expo-qr.png";
await writeFile(targetPath, png);
console.log("QR guardado en:", targetPath);
