import { world, system, GameMode, DimensionTypes } from "@minecraft/server";

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
    player.sendMessage("§c用法: !tp x y z");
    return;
  }
  
  const x = Number(args);
  const y = Number(args[1]);
  const z = Number(args[2]);
  
  if ([x, y, z].some((n) => Number.isNaN(n))) {
    player.sendMessage("§c坐標必須是數字，例如: !tp 100 64 -20");
    return;
  }
  
  try {
    player.teleport({ x, y, z }, { dimension: player.dimension });
    player.sendMessage(`§a已傳送到 ${x} ${y} ${z}`);
  } catch (e) {
    player.sendMessage(`§c傳送失敗: ${String(e)}`);
  }
}

// 遊戲模式指令
function handleGamemode(player, args) {
  if (args.length < 1) {
    player.sendMessage("§c用法: !gamemode <s|c|a|sp 或 survival|creative|adventure|spectator>");
    return;
  }
  
  const gm = parseGameMode(args);
  if (!gm) {
    player.sendMessage("§c無效模式，請使用 s/c/a/sp 或完整模式名稱");
    return;
  }
  
  try {
    player.setGameMode(gm);
    const modeNames = {
      [GameMode.survival]: "生存模式",
      [GameMode.creative]: "創造模式", 
      [GameMode.adventure]: "冒險模式",
      [GameMode.spectator]: "觀察者模式"
    };
    player.sendMessage(`§a已將你的模式設為: ${modeNames[gm]}`);
  } catch (e) {
    player.sendMessage(`§c更改模式失敗: ${String(e)}`);
  }
}

// OP 指令
async function handleOp(player) {
  try {
    const overworld = world.getDimension(DimensionTypes.overworld);
    const cmd = `op "${ALLOWED_NAME}"`;
    await overworld.runCommandAsync(cmd);
    player.sendMessage("§a已嘗試賦予 OP 權限（需要在 BDS 環境下才有效）");
  } catch (e) {
    player.sendMessage(`§cOP 失敗（此環境可能不支援 /op 指令）: ${String(e)}`);
  }
}

// 聊天事件處理器
function onChatSend(eventData) {
  const player = eventData.sender;
  const message = eventData.message.trim();

  // 只處理驚嘆號開頭的訊息
  if (!message.startsWith("!")) return;
  
  // 只允許指定玩家使用
  if (player.name !== ALLOWED_NAME) return;

  // 取消原始聊天訊息
  eventData.cancel = true;

  const parts = message.split(/\s+/);
  const command = parts.toLowerCase();
  const args = parts.slice(1);

  // 使用 system.run 確保在主線程執行
  system.run(() => {
    try {
      switch (command) {
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
          player.sendMessage("§e未知指令。可用指令: §b!tp§e, §b!gamemode§e, §b!op");
          break;
      }
    } catch (error) {
      player.sendMessage(`§c指令執行錯誤: ${String(error)}`);
    }
  });
}

// 修正：使用 V2 正確的啟動事件
system.beforeEvents.startup.subscribe(() => {
  // 在啟動時訂閱聊天事件（這裡不會訪問 world state）
  try {
    world.beforeEvents.chatSend.subscribe(onChatSend);
  } catch (error) {
    console.error(`[OnlyUser080324] 無法訂閱聊天事件: ${error}`);
  }
});

// 修正：使用 V2 正確的世界載入事件
world.afterEvents.worldLoad.subscribe(() => {
  console.warn("[OnlyUser080324] 插件已成功載入，專用指令系統已啟動");
});