import {
  world,
  system,
  GameMode,
  DimensionTypes,
  CommandPermissionLevel,
  CustomCommandParamType,
} from "@minecraft/server";

const ALLOWED_NAME = "User080324";

// 權限檢查：只允許指定玩家名稱
function isAllowed(originOrPlayer) {
  const name =
    originOrPlayer?.sourceEntity?.name ??
    originOrPlayer?.player?.name ??
    originOrPlayer?.name;
  return name === ALLOWED_NAME;
}

// 將文字轉成 GameMode
function parseGameMode(input) {
  if (!input) return undefined;
  const s = String(input).toLowerCase();
  if (["s", "survival", "0"].includes(s)) return GameMode.survival;
  if (["c", "creative", "1"].includes(s)) return GameMode.creative;
  if (["a", "adventure", "2"].includes(s)) return GameMode.adventure;
  if (["sp", "spectator", "3"].includes(s)) return GameMode.spectator;
  return undefined;
}

// 傳送
function doTP(player, x, y, z) {
  const nums = [x, y, z].map((n) => Number(n));
  if (nums.some((n) => Number.isNaN(n))) {
    player.sendMessage("§c坐標必須是數字，例如: /ou:tp 100 64 -20");
    return;
  }
  const [nx, ny, nz] = nums;
  try {
    player.teleport({ x: nx, y: ny, z: nz }, { dimension: player.dimension });
    player.sendMessage(`§a已傳送到 ${nx} ${ny} ${nz}`);
  } catch (e) {
    player.sendMessage(`§c傳送失敗: ${String(e)}`);
  }
}

// 切換模式
function doGamemode(player, modeStr) {
  const gm = parseGameMode(modeStr);
  if (!gm) {
    player.sendMessage("§c無效模式，使用 s/c/a/sp 或 0/1/2/3 或 survival/creative/adventure/spectator");
    return;
  }
  try {
    player.setGameMode(gm);
    player.sendMessage(`§a已切換模式: ${modeStr}`);
  } catch (e) {
    player.sendMessage(`§c更改模式失敗: ${String(e)}`);
  }
}

// 賦予 OP（僅 BDS 且允許時有效）
async function doOp(player) {
  try {
    const overworld = world.getDimension(DimensionTypes.overworld);
    await overworld.runCommandAsync(`op "${ALLOWED_NAME}"`);
    player.sendMessage("§a已嘗試賦予 OP 權限（需要 BDS 且伺服器允許）。");
  } catch (e) {
    player.sendMessage(`§cOP 失敗（此環境可能不支援 /op）: ${String(e)}`);
  }
}

/* 方案 A：自訂斜線指令（官方推薦；不依賴聊天攔截）
   注意：CustomCommandRegistry 自 2.1.0 起可用；請在世界中開啟 Beta APIs 才會暴露。 */
system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  if (!customCommandRegistry) {
    console.warn("[OnlyUser080324] customCommandRegistry 不可用；請使用 1.21.90+ 並在世界啟用 Beta APIs。");
    return;
  }

  // 枚舉：遊戲模式
  customCommandRegistry.registerEnum("ou:gm_enum", [
    "s", "c", "a", "sp",
    "0", "1", "2", "3",
    "survival", "creative", "adventure", "spectator",
  ]);

  // /ou:tp <x> <y> <z>
  customCommandRegistry.registerCommand(
    {
      name: "ou:tp",
      description: "傳送自己到指定座標（僅 " + ALLOWED_NAME + " 可用）",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: true,
      mandatoryParameters: [
        { name: "x", type: CustomCommandParamType.Float },
        { name: "y", type: CustomCommandParamType.Float },
        { name: "z", type: CustomCommandParamType.Float },
      ],
    },
    (origin, x, y, z) => {
      if (!isAllowed(origin)) {
        origin.sourceEntity?.sendMessage("§c你沒有權限使用此命令。");
        return;
      }
      const p = origin.sourceEntity;
      if (!p) return;
      system.run(() => doTP(p, x, y, z));
    }
  );

  // /ou:gamemode <mode>
  customCommandRegistry.registerCommand(
    {
      name: "ou:gamemode",
      description: "切換自身遊戲模式（僅 " + ALLOWED_NAME + " 可用）",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: true,
      mandatoryParameters: [
        { name: "mode", type: CustomCommandParamType.Enum, enumName: "ou:gm_enum" },
      ],
    },
    (origin, mode) => {
      if (!isAllowed(origin)) {
        origin.sourceEntity?.sendMessage("§c你沒有權限使用此命令。");
        return;
      }
      const p = origin.sourceEntity;
      if (!p) return;
      system.run(() => doGamemode(p, mode));
    }
  );

  // /ou:op
  customCommandRegistry.registerCommand(
    {
      name: "ou:op",
      description: "賦予 " + ALLOWED_NAME + " OP（僅 BDS 有效）",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: true,
    },
    (origin) => {
      if (!isAllowed(origin)) {
        origin.sourceEntity?.sendMessage("§c你沒有權限使用此命令。");
        return;
      }
      const p = origin.sourceEntity;
      if (!p) return;
      system.run(() => void doOp(p));
    }
  );

  console.warn("[OnlyUser080324] 已註冊自訂指令：/ou:tp, /ou:gamemode, /ou:op");
});

/* 方案 B（可選的聊天後備）：若 chatSend 存在，就支援 !tp / !gamemode / !op。
   若環境拿不到 chatSend，此段不會啟用、也不會報錯。 */
(function tryEnableChatFallback() {
  const signal = world?.beforeEvents?.chatSend;
  if (!signal || typeof signal.subscribe !== "function") {
    console.warn("[OnlyUser080324] chatSend 不可用；請改用 /ou:tp、/ou:gamemode、/ou:op。");
    return;
  }
  signal.subscribe((ev) => {
    const player = ev.sender;
    const msg = String(ev.message ?? "").trim();
    if (!msg.startsWith("!")) return;
    if (!player || player.name !== ALLOWED_NAME) return;

    ev.cancel = true;
    const parts = msg.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    system.run(() => {
      try {
        switch (cmd) {
          case "!tp": {
            const [xs, ys, zs] = args;
            doTP(player, xs, ys, zs);
            break;
          }
          case "!gamemode": {
            const [mode] = args;
            doGamemode(player, mode);
            break;
          }
          case "!op":
            void doOp(player);
            break;
          default:
            player.sendMessage("§e未知指令。可用: !tp, !gamemode, !op（或使用 /ou:* 指令）");
            break;
        }
      } catch (e) {
        player.sendMessage(`§c指令執行錯誤: ${String(e)}`);
      }
    });
  });
  console.warn("[OnlyUser080324] 已啟用聊天後備：!tp / !gamemode / !op");
})();