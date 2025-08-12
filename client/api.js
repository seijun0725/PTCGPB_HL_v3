class SocketApiService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.eventListeners = new Map(); // 存儲事件監聽器
  }

  // 連接到服務器
  connect() {
    if (this.socket && this.isConnected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.socket = io({
        transports: ["websocket", "polling"],
        timeout: 10000,
      });

      this.socket.on("connect", () => {
        console.log("已連接到Socket.io服務器");
        this.isConnected = true;
        resolve();
      });

      this.socket.on("disconnect", () => {
        console.log("與Socket.io服務器斷線");
        this.isConnected = false;
      });

      this.socket.on("connect_error", (error) => {
        console.error("Socket.io連接錯誤:", error);
        this.isConnected = false;

        // 如果是認證錯誤，重定向到登入頁面
        if (error.message === "Authentication required") {
          window.location.href = "/login.html";
        } else {
          reject(error);
        }
      });

      // 設置通知監聽器
      this.setupNotificationListeners();
    });
  }

  // 設置通知監聽器
  setupNotificationListeners() {
    // 監聽帳號更新通知
    this.socket.on("updateAccount", (account) => {
      console.log("收到帳號更新通知:", account);
      this.emitEvent("updateAccount", account);
    });
  }

  // 監聽通知事件
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  // 移除通知事件監聽器
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // 發射事件給監聽器
  emitEvent(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件 ${event} 的回調函數執行錯誤:`, error);
        }
      });
    }
  }

  // 斷開連接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // 共用函數：處理API請求
  async request(event, data = null) {
    await this.connect();

    return new Promise((resolve, reject) => {
      // console.log(`發送 ${event} 事件，數據:`, data);

      // 設置超時
      const timeout = setTimeout(() => {
        console.log(`${event} 請求超時`);
        reject(new Error("請求超時"));
      }, 20000);

      // 監聽回應事件
      const responseEvent = `${event}Response`;
      const responseHandler = (response) => {
        // console.log(`收到 ${responseEvent} 回應:`, response);
        clearTimeout(timeout);
        this.socket.off(responseEvent, responseHandler);

        if (response && response.code === 0) {
          resolve({
            success: true,
            data: response.data,
            message: response.message,
          });
        } else {
          reject(new Error(response?.message || "未知錯誤"));
        }
      };

      this.socket.on(responseEvent, responseHandler);

      // 發送事件
      this.socket.emit(event, data);
    });
  }

  // 取得版本號
  async getVersion() {
    return this.request("getVersion", null);
  }

  // 帳號相關 API
  async getAccounts() {
    return this.request("getAccounts", null);
  }

  // 登入
  async login(accountId) {
    return this.request("login", { id: accountId });
  }

  // 登出
  async logout(accountId) {
    return this.request("logout", { id: accountId });
  }

  // 加好友
  async approve(accountId) {
    return this.request("approve", { id: accountId });
  }

  // 停止加好友
  async stopApprove(accountId) {
    return this.request("stopApprove", { id: accountId });
  }

  // 取得好友列表
  async getFriendList(accountId) {
    return this.request("getFriendList", { id: accountId });
  }

  // 刪除好友
  async deleteFriend(accountId, playerId) {
    return this.request("deleteFriend", { id: accountId, playerId });
  }

  // 刪除所有好友
  async deleteAllFriends(accountId) {
    return this.request("deleteAllFriends", { id: accountId });
  }

  // 取得得卡列表
  async getFeedList(accountId) {
    return this.request("getFeedList", { id: accountId });
  }

  // 補充得卡力
  async healChallengePower(accountId, type, amount) {
    return this.request("healChallengePower", { id: accountId, type, amount });
  }

  // 開始得卡
  async feedSnoop(accountId, feedId, usedForRevivalChallengePower) {
    return this.request("feedSnoop", {
      id: accountId,
      feedId,
      usedForRevivalChallengePower,
    });
  }

  // 得卡選卡
  async feedChallenge(accountId, feedId, challengeType) {
    return this.request("feedChallenge", {
      id: accountId,
      feedId,
      challengeType,
    });
  }

  // 取得禮物盒
  async getPresentBoxList(accountId) {
    return this.request("getPresentBoxList", { id: accountId });
  }

  // 領取禮物
  async receivePresentBox(accountId, presentBoxIds) {
    return this.request("receivePresentBox", { id: accountId, presentBoxIds });
  }

  // 取得牌組列表
  async getDeckList(accountId) {
    return this.request("getDeckList", { id: accountId });
  }

  // 取得事件能量
  async getEventPowers(accountId) {
    return this.request("getEventPowers", { id: accountId });
  }

  // 開始事件戰鬥
  async startEventBattle(accountId, battleId, myDeckId) {
    return this.request("startEventBattle", {
      id: accountId,
      battleId,
      myDeckId,
    });
  }

  // 結束事件戰鬥
  async finishEventBattle(accountId, battleId, myDeckId, token) {
    return this.request("finishEventBattle", {
      id: accountId,
      battleId,
      myDeckId,
      token,
    });
  }

  // 取得開包力
  async getPackPower(accountId) {
    return this.request("getPackPower", { id: accountId });
  }

  // 開包
  async openPack(accountId, packId, productId, packPowerType) {
    return this.request("openPack", {
      id: accountId,
      packId,
      productId,
      packPowerType,
    });
  }

  // 取得商店購買摘要
  async getItemShopPurchaseSummaries(accountId, productId) {
    return this.request("getItemShopPurchaseSummaries", {
      id: accountId,
      productId,
    });
  }

  // 購買商店商品
  async purchaseItemShop(accountId, productId, ticketAmount, times) {
    return this.request("purchaseItemShop", {
      id: accountId,
      productId,
      ticketAmount,
      times,
    });
  }
}

// 建立全域 Socket API 服務實例
const socketApiService = new SocketApiService();

export default socketApiService;
