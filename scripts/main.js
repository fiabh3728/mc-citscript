import { world, GameMode, DimensionTypes } from "@minecraft/server";

const ALLOWED_NAME = "User080324";

// 將文字模式轉成 GameMode
function parseGameMode(input) {
  if (!input) return undefined;
  const s = String(input).toLowerCase();
  if (["s", "survival", "0"].includes(s)) return GameMode.survival;
  if (["c", "creative", "1"].includes(s)) return GameMode.creative;
  if (["a", "adventure", "2"].includes(s)) return GameMode.adventure;
  if (["sp", "spectator", "3"].includes(s)) return GameMode.spectator;
  return undefined;
}

// 傳送指令
function handleTP(player, args) {
  if (args.length < 3) {
    player.sendMessage("用法: !tp x y z");
    return;
  }
  const x = Number(args[0]);
  const y = Number(args[1]);
  const z = Number(args[2]);
  if ([x, y, z].some(n => Number.isNaN(n))) {
    player.sendMessage("坐標必須是數字，例如: !tp 100 64 -20");
    return;
  }
  try {
    player.teleport({ x, y, z }, { dimension: player.dimension });
    player.sendMessage(`已傳送到 ${x} ${y} ${z}`);
  } catch (e) {
    player.sendMessage(`傳送失敗: ${String(e)}`);
  }
}

// 遊戲模式指令
function handleGamemode(player, args) {
  if (args.length < 1) {
    player.sendMessage("用法: !gamemode <s|c|a|sp 或 0|1|2|3>");
    return;
  }
  const gm = parseGameMode(args[0]);
  if (!gm) {
    player.sendMessage("無效模式，請使用 s/c/a/sp 或 0/1/2/3");
    return;
  }
  try {
    player.setGameMode(gm);
    player.sendMessage(`已將你的模式設為: ${args[0]}`);
  } catch (e) {
    player.sendMessage(`更改模式失敗: ${String(e)}`);
  }
}

// OP 指令（BDS 上有效）
async function handleOp(player) {
  try {
    const overworld = world.getDimension(DimensionTypes.overworld);
    const cmd = `op ${ALLOWED_NAME}`;
    const res = await overworld.runCommandAsync(cmd);
    // res.successCount 可用於回饋，但不同版本回傳略有差異
    player.sendMessage("已嘗試賦予 OP 權限（若為 BDS 且允許指令則會成功）。");
  } catch (e) {
    player.sendMessage(`OP 失敗（此世界可能不支援 /op）: ${String(e)}`);
  }
}

world.beforeEvents.chatSend.subscribe(ev => {
  const player = ev.sender;
  const msg = ev.message.trim();

  // 只攔截有驚嘆號開頭的訊息，並限制為指定玩家
  if (!msg.startsWith("!")) return;
  if (player.name !== ALLOWED_NAME) return;

  // 我們自己處理，不讓訊息出現在公開聊天
  ev.cancel = true;

  const parts = msg.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  try {
    switch (cmd) {
      case "!tp":
        handleTP(player, args);
        break;
      case "!gamemode":
        handleGamemode(player, args);
        break;
      case "!op":
        handleOp(player);
        break;
      default:
        player.sendMessage("未知指令。可用指令: !tp, !gamemode, !op");
        break;
    }
  } catch (e) {
    player.sendMessage(`指令執行錯誤: ${String(e)}`);
  }
});