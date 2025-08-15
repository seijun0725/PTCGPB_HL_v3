const express = require("express");
const session = require("express-session");
const open = require("open");
const { createServer } = require("http");
const { Server } = require("socket.io");
const actions = require("./actions");

const mainConfig = require("../config/main.json");
const versionConfig = require("../config/version.json");

actions.init();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  // 同源請求，不需要 CORS 配置
});

// 根據配置決定是否啟用 session
let sessionMiddleware = null;
if (mainConfig.auth?.enable) {
  sessionMiddleware = session({
    secret: mainConfig.auth.secret,
    resave: false,
    saveUninitialized: false,
  });

  app.use(sessionMiddleware);
}

// 驗證中間件
const authMiddleware = (req, res, next) => {
  if (
    !mainConfig.auth?.enable ||
    req.path === "/login.html" ||
    req.session?.authenticated
  ) {
    next();
  } else {
    res.redirect("/login.html");
  }
};

app.use(express.json());

// 登入 API
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === mainConfig.auth?.username &&
    password === mainConfig.auth?.password
  ) {
    req.session.authenticated = true;
    res.json({ code: 0, message: "success" });
  } else {
    res.status(401).json({ code: 401, message: "error" });
  }
});

// 靜態資源
app.use("/", authMiddleware, express.static("client"));

// 共用函數：發送成功回應
const sendSuccessResponse = (socket, eventName, data) => {
  socket.emit(`${eventName}Response`, {
    code: 0,
    message: "success",
    data,
  });
  console.log(`已發送 ${eventName}Response`);
};

// 共用函數：發送錯誤回應
const sendErrorResponse = (socket, eventName, error) => {
  console.error(`${eventName} 錯誤:`, error);
  socket.emit(`${eventName}Response`, {
    code: 500,
    message: error.message || "未知錯誤",
    data: null,
  });
};

// 共用函數：處理Socket事件
const handleSocketEvent = async (socket, eventName, handler) => {
  try {
    const result = await handler();
    sendSuccessResponse(socket, eventName, result);
  } catch (error) {
    sendErrorResponse(socket, eventName, error);
  }
};

// 根據配置決定是否啟用 Socket.IO 驗證
if (mainConfig.auth?.enable && sessionMiddleware) {
  // 將 session 中間件應用到 Socket.IO
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  // Socket.IO 驗證
  io.use((socket, next) => {
    const session = socket.request.session;
    console.log("Socket session:", session);
    if (session && session.authenticated) {
      next();
    } else {
      next(new Error("Authentication required"));
    }
  });
}

// Socket.io 事件處理
io.on("connection", (socket) => {
  console.log("客戶端已連接:", socket.id);

  // 設置 socket 實例到 actions
  actions.setSocket(socket);

  // 取得版本號
  socket.on("getVersion", async (data) => {
    await handleSocketEvent(socket, "getVersion", () => {
      return versionConfig.version;
    });
  });

  // 獲取帳號列表
  socket.on("getAccounts", async (data) => {
    console.log("收到 getAccounts 請求");

    await handleSocketEvent(socket, "getAccounts", () => {
      const accounts = actions.getAccounts();
      return { accounts };
    });
  });

  // 登入
  socket.on("login", async (data) => {
    console.log("收到 login 請求");
    const account = await actions.doLogin(data.id);
    await handleSocketEvent(socket, "login", () => {
      return account;
    });
  });

  // 登出
  socket.on("logout", async (data) => {
    console.log("收到 logout 請求");
    const account = await actions.doLogout(data.id);
    await handleSocketEvent(socket, "logout", () => {
      return account;
    });
  });

  // 取得玩家資源
  socket.on("getPlayerResources", async (data) => {
    console.log("收到 getPlayerResources 請求");
    const playerResources = await actions.doGetPlayerResources(data.id);
    await handleSocketEvent(socket, "getPlayerResources", () => {
      return playerResources;
    });
  });

  // 加好友
  socket.on("approve", async (data) => {
    console.log("收到 approve 請求");
    const account = await actions.doApprove(data.id);
    await handleSocketEvent(socket, "approve", () => {
      return account;
    });
  });

  // 停止加好友
  socket.on("stopApprove", async (data) => {
    console.log("收到 stopApprove 請求");
    const account = await actions.doStopApprove(data.id);
    await handleSocketEvent(socket, "stopApprove", () => {
      return account;
    });
  });

  // 取得好友列表
  socket.on("getFriendList", async (data) => {
    console.log("收到 getFriendList 請求");
    const friendList = await actions.doGetFriendList(data.id);
    await handleSocketEvent(socket, "getFriendList", () => {
      return friendList;
    });
  });

  // 刪除好友
  socket.on("deleteFriend", async (data) => {
    console.log("收到 deleteFriend 請求");
    await actions.doDeleteFriend(data.id, data.playerId);
    await handleSocketEvent(socket, "deleteFriend", () => {
      return {};
    });
  });

  // 刪除所有好友
  socket.on("deleteAllFriends", async (data) => {
    console.log("收到 deleteAllFriends 請求");
    const account = await actions.doDeleteAllFriends(data.id);
    await handleSocketEvent(socket, "deleteAllFriends", () => {
      return account;
    });
  });

  // 取得得卡列表
  socket.on("getFeedList", async (data) => {
    console.log("收到 getFeedList 請求");
    const feedList = await actions.doGetFeedList(data.id);
    await handleSocketEvent(socket, "getFeedList", () => {
      return feedList;
    });
  });

  // 補充得卡力
  socket.on("healChallengePower", async (data) => {
    console.log("收到 healChallengePower 請求");
    await actions.doHealChallengePower(
      data.id,
      data.type,
      data.amount,
      data.vcAmount
    );
    await handleSocketEvent(socket, "healChallengePower", () => {
      return {};
    });
  });

  // 開始得卡
  socket.on("feedSnoop", async (data) => {
    console.log("收到 feedSnoop 請求");
    const feed = await actions.doFeedSnoop(
      data.id,
      data.feedId,
      data.usedForRevivalChallengePower
    );
    await handleSocketEvent(socket, "feedSnoop", () => {
      return feed;
    });
  });

  // 得卡選卡
  socket.on("feedChallenge", async (data) => {
    console.log("收到 feedChallenge 請求");
    const pickedCards = await actions.doFeedChallenge(
      data.id,
      data.feedId,
      data.challengeType,
      data.feedType
    );
    await handleSocketEvent(socket, "feedChallenge", () => {
      return pickedCards;
    });
  });

  // 取得禮物列表
  socket.on("getPresentBoxList", async (data) => {
    console.log("收到 getPresentBoxList 請求");
    const presentBoxList = await actions.doGetPresentBoxList(data.id);
    await handleSocketEvent(socket, "getPresentBoxList", () => {
      return presentBoxList;
    });
  });

  // 領取禮物
  socket.on("receivePresentBox", async (data) => {
    console.log("收到 receivePresentBox 請求");
    const receivePresentBox = await actions.doReceivePresentBox(
      data.id,
      data.presentBoxIds
    );
    await handleSocketEvent(socket, "receivePresentBox", () => {
      return receivePresentBox;
    });
  });

  // 取得牌組列表
  socket.on("getDeckList", async (data) => {
    console.log("收到 getDeckList 請求");
    const deckList = await actions.doGetDeckList(data.id);
    await handleSocketEvent(socket, "getDeckList", () => {
      return deckList;
    });
  });

  // 取得事件能量
  socket.on("getEventPowers", async (data) => {
    console.log("收到 getEventPowers 請求");
    const eventPowers = await actions.doGetEventPowers(data.id);
    await handleSocketEvent(socket, "getEventPowers", () => {
      return eventPowers;
    });
  });

  // 開始事件戰鬥
  socket.on("startEventBattle", async (data) => {
    console.log("收到 startEventBattle 請求");
    const eventBattle = await actions.doStartEventBattle(
      data.id,
      data.battleId,
      data.myDeckId
    );
    await handleSocketEvent(socket, "startEventBattle", () => {
      return eventBattle;
    });
  });

  // 結束事件戰鬥
  socket.on("finishEventBattle", async (data) => {
    console.log("收到 finishEventBattle 請求");
    await actions.doFinishEventBattle(
      data.id,
      data.battleId,
      data.myDeckId,
      data.token
    );
    await handleSocketEvent(socket, "finishEventBattle", () => {
      return {};
    });
  });

  // 取得開包力
  socket.on("getPackPower", async (data) => {
    console.log("收到 getPackPower 請求");
    const packPower = await actions.doGetPackPower(data.id);
    await handleSocketEvent(socket, "getPackPower", () => {
      return packPower;
    });
  });

  // 開包
  socket.on("openPack", async (data) => {
    console.log("收到 openPack 請求");
    const openPack = await actions.doOpenPack(
      data.id,
      data.packId,
      data.productId,
      data.packPowerType
    );
    await handleSocketEvent(socket, "openPack", () => {
      return openPack;
    });
  });

  // 取得商店購買摘要
  socket.on("getItemShopPurchaseSummaries", async (data) => {
    console.log("收到 getItemShopPurchaseSummaries 請求");
    const itemShopPurchaseSummaries =
      await actions.doGetItemShopPurchaseSummaries(data.id, data.productId);
    await handleSocketEvent(socket, "getItemShopPurchaseSummaries", () => {
      return itemShopPurchaseSummaries;
    });
  });

  // 購買商店商品
  socket.on("purchaseItemShop", async (data) => {
    console.log("收到 purchaseItemShop 請求");
    await actions.doPurchaseItemShop(
      data.id,
      data.productId,
      data.ticketAmount,
      data.times
    );
    await handleSocketEvent(socket, "purchaseItemShop", () => {
      return {};
    });
  });

  // 斷線處理
  socket.on("disconnect", () => {
    console.log("客戶端已斷線:", socket.id);
  });
});

server.listen(mainConfig.webUiPort, () => {
  console.log(`Socket.io 服務器運行在端口 ${mainConfig.webUiPort}`);
  open(`http://localhost:${mainConfig.webUiPort}/`);
});
