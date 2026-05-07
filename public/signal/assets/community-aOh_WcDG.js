import { k as keyframes, s as styled, r as reactExports, x as jsxRuntimeExports, w as useTheme, I as initializeApp, J as getAuth, K as getFirestore, L as getFunctions, M as connectAuthEmulator, N as connectFirestoreEmulator, P as connectFunctionsEmulator, g as getDefaultExportFromCjs, m as makeObservable, o as observable, c as computed, V as Global, U as css, C as configure, W as getDependencyTree, e as requireReact, R as React, X as Reaction, y as React$1, Q as createLocalization, S as FirebaseAuthUI, G as GoogleAuthProvider, z as GithubAuthProvider, T as ThemeProvider, D as clientExports } from "./index-BsFNT9rD.js";
import { ae as Root$1, aq as Warning, aI as CheckCircle, ar as Info, aJ as Error$1, aP as requireIsSymbol, g as require_baseIteratee, u as uniq, l as lodashExports, m as read, n as createUserRepository, o as createCloudSongRepository, p as createCloudSongDataRepository, x as SoundFontSynth, y as Player, ai as reactDomExports, C as Color, N as NinetyRingWithBg, aQ as requireDebounce, v as SoundFont, aE as Pause, aF as PlayArrow, E as useToast, I as Content2, U as Root2, T as Trigger, L as Portal2, al as AccountCircle, ad as Circle, O as Overlay, a as Content$5, R as Root$2, P as Portal, at as TwitterShareButton, as as XIcon, av as FacebookShareButton, au as FacebookIcon, ax as WhatsappShareButton, aw as WhatsappIcon, az as VKShareButton, ay as VKIcon, aB as WeiboShareButton, aA as WeiboIcon, aD as EmailShareButton, aC as EmailIcon, ak as Helmet, aK as HelmetProvider, aL as ToastProvider } from "./CheckCircleIcon-Bj48UdEK.js";
const contentShow$1 = keyframes`
  from {
    opacity: 0;
    transform: translate(0, 0.5rem) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
`;
const contentHide = keyframes`
  from {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(0, 0.5rem) scale(0.96);
  }
`;
const Root = styled(Root$1)`
  position: fixed;
  bottom: 2rem;
  left: 0;
  right: 0;
  display: flex;
`;
const Content$4 = styled.div`
  margin: 0 auto;
  background: var(--color-background-secondary);
  padding: 1rem;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  box-shadow: 0 0.5rem 3rem var(--color-shadow);
  display: flex;
  align-items: center;

  animation: ${({ show }) => show ? contentShow$1 : contentHide}
    500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
`;
const SeverityIcon$1 = ({ severity }) => {
  const theme = useTheme();
  const fill = colorForSeverity(severity, theme);
  switch (severity) {
    case "error":
      return jsxRuntimeExports.jsx(Error$1, { style: { fill } });
    case "info":
      return jsxRuntimeExports.jsx(Info, { style: { fill } });
    case "success":
      return jsxRuntimeExports.jsx(CheckCircle, { style: { fill } });
    case "warning":
      return jsxRuntimeExports.jsx(Warning, { style: { fill } });
  }
};
const exitDuration = 5e3;
const Toast = ({ message, severity, onExited }) => {
  const [show, setShow] = reactExports.useState(true);
  reactExports.useEffect(() => {
    const timeout = setTimeout(() => setShow(false), exitDuration - 500);
    const timeout2 = setTimeout(onExited, exitDuration);
    return () => {
      clearTimeout(timeout);
      clearTimeout(timeout2);
    };
  });
  return jsxRuntimeExports.jsx(Root, { children: jsxRuntimeExports.jsxs(Content$4, { show, children: [jsxRuntimeExports.jsx(SeverityIcon$1, { severity }), jsxRuntimeExports.jsx("div", { style: { width: "0.5rem" } }), message] }) });
};
const colorForSeverity = (severity, theme) => {
  switch (severity) {
    case "error":
      return theme.redColor;
    case "info":
      return theme.textColor;
    case "success":
      return theme.greenColor;
    case "warning":
      return theme.yellowColor;
  }
};
const StoreContext = reactExports.createContext(null);
const useStores = () => reactExports.useContext(StoreContext);
var define_process_env_default = {};
const firebaseConfig = {
  apiKey: define_process_env_default.FIREBASE_API_KEY,
  authDomain: define_process_env_default.FIREBASE_AUTH_DOMAIN,
  projectId: define_process_env_default.FIREBASE_PROJECT_ID,
  storageBucket: define_process_env_default.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: define_process_env_default.FIREBASE_MESSAGING_SENDER_ID,
  appId: define_process_env_default.FIREBASE_APP_ID
};
const modules = (() => {
  try {
    const app2 = initializeApp(firebaseConfig);
    const auth2 = getAuth(app2);
    const firestore2 = getFirestore(app2);
    const functions2 = getFunctions(app2);
    if (false) ;
    return {
      app: app2,
      auth: auth2,
      firestore: firestore2,
      functions: functions2
    };
  } catch (e) {
    console.warn(`Failed to initialize Firebase: ${e}`);
  }
  return {
    app: null,
    auth: null,
    firestore: null,
    functions: null
  };
})();
modules.app;
const auth = modules.auth;
const firestore = modules.firestore;
modules.functions;
var _baseExtremum;
var hasRequired_baseExtremum;
function require_baseExtremum() {
  if (hasRequired_baseExtremum) return _baseExtremum;
  hasRequired_baseExtremum = 1;
  var isSymbol = requireIsSymbol();
  function baseExtremum(array, iteratee, comparator) {
    var index = -1, length = array.length;
    while (++index < length) {
      var value = array[index], current = iteratee(value);
      if (current != null && (computed2 === void 0 ? current === current && !isSymbol(current) : comparator(current, computed2))) {
        var computed2 = current, result = value;
      }
    }
    return result;
  }
  _baseExtremum = baseExtremum;
  return _baseExtremum;
}
var _baseGt;
var hasRequired_baseGt;
function require_baseGt() {
  if (hasRequired_baseGt) return _baseGt;
  hasRequired_baseGt = 1;
  function baseGt(value, other) {
    return value > other;
  }
  _baseGt = baseGt;
  return _baseGt;
}
var maxBy_1;
var hasRequiredMaxBy;
function requireMaxBy() {
  if (hasRequiredMaxBy) return maxBy_1;
  hasRequiredMaxBy = 1;
  var baseExtremum = require_baseExtremum(), baseGt = require_baseGt(), baseIteratee = require_baseIteratee();
  function maxBy2(array, iteratee) {
    return array && array.length ? baseExtremum(array, baseIteratee(iteratee, 2), baseGt) : void 0;
  }
  maxBy_1 = maxBy2;
  return maxBy_1;
}
var maxByExports = requireMaxBy();
const maxBy = /* @__PURE__ */ getDefaultExportFromCjs(maxByExports);
function isNotUndefined(a) {
  return a !== void 0;
}
const isProgramChangeEvent = (e) => "subtype" in e && e.subtype === "programChange";
const isPitchBendEvent = (e) => "subtype" in e && e.subtype === "pitchBend";
const isSetTempoEvent = (e) => "subtype" in e && e.subtype === "setTempo";
const isControllerEvent = (e) => "subtype" in e && e.subtype === "controller";
const isControllerEventWithType = (controllerType) => (e) => isControllerEvent(e) && e.controllerType === controllerType;
const isEventInRange = (startTick, endTick) => (e) => e.tick >= startTick && e.tick < endTick;
class EventSource {
  songProvider;
  constructor(songProvider) {
    this.songProvider = songProvider;
  }
  get timebase() {
    return this.songProvider.song.timebase;
  }
  get endOfSong() {
    return this.songProvider.song.endOfSong;
  }
  getEvents(startTick, endTick) {
    return this.songProvider.song.tracks.flatMap((track) => track.events.filter(isEventInRange(startTick, endTick)).map((event) => ({
      ...event,
      trackId: -1
    })));
  }
  getCurrentStateEvents(tick) {
    return this.songProvider.song.tracks.flatMap((t) => {
      const statusEvents = getStatusEvents(t.events, tick);
      return statusEvents.map((e) => ({
        ...e,
        trackId: -1
      }));
    });
  }
}
const getLast = (events2) => maxBy(events2, (e) => e.tick);
const isTickBefore = (tick) => (e) => e.tick <= tick;
const getStatusEvents = (events2, tick) => {
  const controlEvents = events2.filter(isControllerEvent).filter(isTickBefore(tick));
  const recentControlEvents = uniq(controlEvents.map((e) => e.controllerType)).map((type) => getLast(controlEvents.filter(isControllerEventWithType(type)))).filter(isNotUndefined);
  const setTempo = getLast(events2.filter(isSetTempoEvent).filter(isTickBefore(tick)));
  const programChange = getLast(events2.filter(isProgramChangeEvent).filter(isTickBefore(tick)));
  const pitchBend = getLast(events2.filter(isPitchBendEvent).filter(isTickBefore(tick)));
  return [...recentControlEvents, setTempo, programChange, pitchBend].filter(isNotUndefined);
};
class AuthStore {
  userRepository;
  authUser = null;
  user = null;
  constructor(userRepository) {
    this.userRepository = userRepository;
    makeObservable(this, {
      authUser: observable,
      user: observable
    });
    let subscribe = null;
    try {
      userRepository.observeAuthUser(async (user) => {
        this.authUser = user;
        subscribe?.();
        if (user !== null) {
          subscribe = userRepository.observeCurrentUser((user2) => {
            this.user = user2;
          });
          await this.createProfileIfNeeded(user);
        }
      });
    } catch (e) {
      console.warn(e);
    }
  }
  async createProfileIfNeeded(authUser) {
    const user = await this.userRepository.getCurrentUser();
    if (user === null) {
      const newUserData = {
        name: authUser.displayName ?? "",
        bio: ""
      };
      await this.userRepository.create(newUserData);
    }
  }
  get isLoggedIn() {
    return this.authUser !== null;
  }
}
class CommunitySongStore {
  songs = [];
  constructor() {
    makeObservable(this, {
      songs: observable
    });
  }
}
class RootViewStore {
  openSignInDialog = false;
  constructor() {
    makeObservable(this, {
      openSignInDialog: observable
    });
  }
}
function addTick(events2) {
  let tick = 0;
  return events2.map((e) => {
    const { deltaTime, ...rest } = e;
    tick += deltaTime;
    return {
      ...rest,
      tick
    };
  });
}
function getEndOfTrack(events2) {
  return lodashExports.max(events2.map((event) => event.tick)) ?? 0;
}
class Song {
  timebase;
  endOfSong;
  tracks;
  constructor(midi) {
    this.timebase = midi.header.ticksPerBeat;
    this.tracks = midi.tracks.map((track) => {
      const events2 = addTick(track);
      const endOfTrack = getEndOfTrack(events2);
      return { events: events2, endOfTrack };
    });
    this.endOfSong = this.tracks.map((track) => track.endOfTrack).reduce((a, b) => Math.max(a, b), 0);
  }
}
const emptySong = () => new Song({
  header: { ticksPerBeat: 480 },
  tracks: []
});
class SongStore {
  songDataRepository;
  currentSong = null;
  isLoading = false;
  constructor(songDataRepository) {
    this.songDataRepository = songDataRepository;
    makeObservable(this, {
      song: computed,
      currentSong: observable,
      isLoading: observable
    });
  }
  get song() {
    return this.currentSong?.song ?? emptySong();
  }
  async loadSong(cloudSong) {
    this.isLoading = true;
    const songData = await this.songDataRepository.get(cloudSong.songDataId);
    const song = new Song(read(songData));
    this.currentSong = {
      song,
      metadata: cloudSong
    };
    this.isLoading = false;
  }
}
class RootStore {
  userRepository = createUserRepository(firestore, auth);
  cloudSongRepository = createCloudSongRepository(firestore, auth);
  cloudSongDataRepository = createCloudSongDataRepository(firestore, auth);
  songStore = new SongStore(this.cloudSongDataRepository);
  authStore = new AuthStore(this.userRepository);
  communitySongStore = new CommunitySongStore();
  rootViewStore = new RootViewStore();
  player;
  synth;
  constructor() {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    this.synth = new SoundFontSynth(context);
    const eventSource = new EventSource(this.songStore);
    this.player = new Player(this.synth, eventSource);
  }
}
const defaultTheme = {
  font: "Inter, -apple-system, BlinkMacSystemFont, Avenir, Lato",
  canvasFont: "Arial",
  themeColor: "hsl(230, 70%, 55%)",
  textColor: "#ffffff",
  secondaryTextColor: "hsl(223, 12%, 60%)",
  tertiaryTextColor: "#5a6173",
  dividerColor: "hsl(224, 12%, 24%)",
  darkBackgroundColor: "hsl(228, 10%, 13%)",
  backgroundColor: "hsl(228, 10%, 16%)",
  secondaryBackgroundColor: "hsl(227, 10%, 22%)",
  shadowColor: "rgba(0, 0, 0, 0.2)",
  highlightColor: "#8388a51a",
  greenColor: "#31DE53",
  redColor: "#DE5267",
  yellowColor: "#DEB126"
};
const GlobalCSS = () => {
  const theme = useTheme();
  return jsxRuntimeExports.jsx(Global, { styles: css`
        /* theme */
        :root {
          --font-sans: ${theme.font};
          --font-canvas: ${theme.canvasFont};
          --color-theme: ${theme.themeColor};
          --color-background: ${theme.backgroundColor};
          --color-background-secondary: ${theme.secondaryBackgroundColor};
          --color-background-dark: ${theme.darkBackgroundColor};
          --color-divider: ${theme.dividerColor};
          --color-text: ${theme.textColor};
          --color-text-secondary: ${theme.secondaryTextColor};
          --color-text-tertiary: ${theme.tertiaryTextColor};
          --color-shadow: ${theme.shadowColor};
          --color-highlight: ${theme.highlightColor};
          --color-green: ${theme.greenColor};
          --color-red: ${theme.redColor};
          --color-yellow: ${theme.yellowColor};
        }

        html {
          font-size: 16px;
        }

        html,
        body {
          height: 100%;
          margin: 0;
        }

        body {
          -webkit-font-smoothing: subpixel-antialiased;
          color: ${theme.textColor};
          background-color: ${theme.backgroundColor};
          overscroll-behavior: none;
          font-family: ${theme.font};
          font-size: 0.75rem;
        }

        #root {
          height: 100%;
        }

        /* firebase */
        .firebase-emulator-warning {
          width: auto !important;
        }
      ` });
};
if (!reactExports.useState) {
  throw new Error("mobx-react-lite requires React with Hooks support");
}
if (!makeObservable) {
  throw new Error("mobx-react-lite@3 requires mobx at least version 6 to be available");
}
function defaultNoopBatch(callback) {
  callback();
}
function observerBatching(reactionScheduler) {
  if (!reactionScheduler) {
    reactionScheduler = defaultNoopBatch;
  }
  configure({ reactionScheduler });
}
function printDebugValue(v) {
  return getDependencyTree(v);
}
var REGISTRY_FINALIZE_AFTER = 1e4;
var REGISTRY_SWEEP_INTERVAL = 1e4;
var TimerBasedFinalizationRegistry = (
  /** @class */
  (function() {
    function TimerBasedFinalizationRegistry2(finalize) {
      var _this = this;
      Object.defineProperty(this, "finalize", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: finalize
      });
      Object.defineProperty(this, "registrations", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: /* @__PURE__ */ new Map()
      });
      Object.defineProperty(this, "sweepTimeout", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, "sweep", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: function(maxAge) {
          if (maxAge === void 0) {
            maxAge = REGISTRY_FINALIZE_AFTER;
          }
          clearTimeout(_this.sweepTimeout);
          _this.sweepTimeout = void 0;
          var now = Date.now();
          _this.registrations.forEach(function(registration, token) {
            if (now - registration.registeredAt >= maxAge) {
              _this.finalize(registration.value);
              _this.registrations.delete(token);
            }
          });
          if (_this.registrations.size > 0) {
            _this.scheduleSweep();
          }
        }
      });
      Object.defineProperty(this, "finalizeAllImmediately", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: function() {
          _this.sweep(0);
        }
      });
    }
    Object.defineProperty(TimerBasedFinalizationRegistry2.prototype, "register", {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function(target, value, token) {
        this.registrations.set(token, {
          value,
          registeredAt: Date.now()
        });
        this.scheduleSweep();
      }
    });
    Object.defineProperty(TimerBasedFinalizationRegistry2.prototype, "unregister", {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function(token) {
        this.registrations.delete(token);
      }
    });
    Object.defineProperty(TimerBasedFinalizationRegistry2.prototype, "scheduleSweep", {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function() {
        if (this.sweepTimeout === void 0) {
          this.sweepTimeout = setTimeout(this.sweep, REGISTRY_SWEEP_INTERVAL);
        }
      }
    });
    return TimerBasedFinalizationRegistry2;
  })()
);
var UniversalFinalizationRegistry = typeof FinalizationRegistry !== "undefined" ? FinalizationRegistry : TimerBasedFinalizationRegistry;
var observerFinalizationRegistry = new UniversalFinalizationRegistry(function(adm) {
  var _a2;
  (_a2 = adm.reaction) === null || _a2 === void 0 ? void 0 : _a2.dispose();
  adm.reaction = null;
});
var shim = { exports: {} };
var useSyncExternalStoreShim_production = {};
var hasRequiredUseSyncExternalStoreShim_production;
function requireUseSyncExternalStoreShim_production() {
  if (hasRequiredUseSyncExternalStoreShim_production) return useSyncExternalStoreShim_production;
  hasRequiredUseSyncExternalStoreShim_production = 1;
  var React2 = requireReact();
  function is(x, y) {
    return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
  }
  var objectIs = "function" === typeof Object.is ? Object.is : is, useState = React2.useState, useEffect = React2.useEffect, useLayoutEffect = React2.useLayoutEffect, useDebugValue = React2.useDebugValue;
  function useSyncExternalStore$2(subscribe, getSnapshot) {
    var value = getSnapshot(), _useState = useState({ inst: { value, getSnapshot } }), inst = _useState[0].inst, forceUpdate = _useState[1];
    useLayoutEffect(
      function() {
        inst.value = value;
        inst.getSnapshot = getSnapshot;
        checkIfSnapshotChanged(inst) && forceUpdate({ inst });
      },
      [subscribe, value, getSnapshot]
    );
    useEffect(
      function() {
        checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        return subscribe(function() {
          checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        });
      },
      [subscribe]
    );
    useDebugValue(value);
    return value;
  }
  function checkIfSnapshotChanged(inst) {
    var latestGetSnapshot = inst.getSnapshot;
    inst = inst.value;
    try {
      var nextValue = latestGetSnapshot();
      return !objectIs(inst, nextValue);
    } catch (error) {
      return true;
    }
  }
  function useSyncExternalStore$1(subscribe, getSnapshot) {
    return getSnapshot();
  }
  var shim2 = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
  useSyncExternalStoreShim_production.useSyncExternalStore = void 0 !== React2.useSyncExternalStore ? React2.useSyncExternalStore : shim2;
  return useSyncExternalStoreShim_production;
}
var hasRequiredShim;
function requireShim() {
  if (hasRequiredShim) return shim.exports;
  hasRequiredShim = 1;
  {
    shim.exports = requireUseSyncExternalStoreShim_production();
  }
  return shim.exports;
}
var shimExports = requireShim();
function createReaction(adm) {
  adm.reaction = new Reaction("observer".concat(adm.name), function() {
    var _a2;
    adm.stateVersion = /* @__PURE__ */ Symbol();
    (_a2 = adm.onStoreChange) === null || _a2 === void 0 ? void 0 : _a2.call(adm);
  });
}
function useObserver(render, baseComponentName) {
  if (baseComponentName === void 0) {
    baseComponentName = "observed";
  }
  var admRef = React.useRef(null);
  if (!admRef.current) {
    var adm_1 = {
      reaction: null,
      onStoreChange: null,
      stateVersion: /* @__PURE__ */ Symbol(),
      name: baseComponentName,
      subscribe: function(onStoreChange) {
        observerFinalizationRegistry.unregister(adm_1);
        adm_1.onStoreChange = onStoreChange;
        if (!adm_1.reaction) {
          createReaction(adm_1);
          adm_1.stateVersion = /* @__PURE__ */ Symbol();
        }
        return function() {
          var _a2;
          adm_1.onStoreChange = null;
          (_a2 = adm_1.reaction) === null || _a2 === void 0 ? void 0 : _a2.dispose();
          adm_1.reaction = null;
        };
      },
      getSnapshot: function() {
        return adm_1.stateVersion;
      }
    };
    admRef.current = adm_1;
  }
  var adm = admRef.current;
  if (!adm.reaction) {
    createReaction(adm);
    observerFinalizationRegistry.register(admRef, adm, adm);
  }
  React.useDebugValue(adm.reaction, printDebugValue);
  shimExports.useSyncExternalStore(
    // Both of these must be stable, otherwise it would keep resubscribing every render.
    adm.subscribe,
    adm.getSnapshot,
    adm.getSnapshot
  );
  var renderResult;
  var exception;
  adm.reaction.track(function() {
    try {
      renderResult = render();
    } catch (e) {
      exception = e;
    }
  });
  if (exception) {
    throw exception;
  }
  return renderResult;
}
var _a$1, _b;
var hasSymbol = typeof Symbol === "function" && Symbol.for;
var isFunctionNameConfigurable = (_b = (_a$1 = Object.getOwnPropertyDescriptor(function() {
}, "name")) === null || _a$1 === void 0 ? void 0 : _a$1.configurable) !== null && _b !== void 0 ? _b : false;
var ReactForwardRefSymbol = hasSymbol ? /* @__PURE__ */ Symbol.for("react.forward_ref") : typeof reactExports.forwardRef === "function" && reactExports.forwardRef(function(props) {
  return null;
})["$$typeof"];
var ReactMemoSymbol = hasSymbol ? /* @__PURE__ */ Symbol.for("react.memo") : typeof reactExports.memo === "function" && reactExports.memo(function(props) {
  return null;
})["$$typeof"];
function observer(baseComponent, options) {
  var _a2;
  if (ReactMemoSymbol && baseComponent["$$typeof"] === ReactMemoSymbol) {
    throw new Error("[mobx-react-lite] You are trying to use `observer` on a function component wrapped in either another `observer` or `React.memo`. The observer already applies 'React.memo' for you.");
  }
  var useForwardRef = (_a2 = void 0) !== null && _a2 !== void 0 ? _a2 : false;
  var render = baseComponent;
  var baseComponentName = baseComponent.displayName || baseComponent.name;
  if (ReactForwardRefSymbol && baseComponent["$$typeof"] === ReactForwardRefSymbol) {
    useForwardRef = true;
    render = baseComponent["render"];
    if (typeof render !== "function") {
      throw new Error("[mobx-react-lite] `render` property of ForwardRef was not a function");
    }
  }
  var observerComponent = function(props, ref) {
    return useObserver(function() {
      return render(props, ref);
    }, baseComponentName);
  };
  observerComponent.displayName = baseComponent.displayName;
  if (isFunctionNameConfigurable) {
    Object.defineProperty(observerComponent, "name", {
      value: baseComponent.name,
      writable: true,
      configurable: true
    });
  }
  if (baseComponent.contextTypes) {
    observerComponent.contextTypes = baseComponent.contextTypes;
  }
  if (useForwardRef) {
    observerComponent = reactExports.forwardRef(observerComponent);
  }
  observerComponent = reactExports.memo(observerComponent);
  copyStaticProperties(baseComponent, observerComponent);
  return observerComponent;
}
var hoistBlackList = {
  $$typeof: true,
  render: true,
  compare: true,
  type: true,
  // Don't redefine `displayName`,
  // it's defined as getter-setter pair on `memo` (see #3192).
  displayName: true
};
function copyStaticProperties(base, target) {
  Object.keys(base).forEach(function(key) {
    if (!hoistBlackList[key]) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(base, key));
    }
  });
}
var _a;
observerBatching(reactDomExports.unstable_batchedUpdates);
(_a = observerFinalizationRegistry["finalizeAllImmediately"]) !== null && _a !== void 0 ? _a : (function() {
});
function parse(input, loose) {
  if (input instanceof RegExp) return { keys: false, pattern: input };
  var c, o, tmp, ext, keys = [], pattern = "", arr = input.split("/");
  arr[0] || arr.shift();
  while (tmp = arr.shift()) {
    c = tmp[0];
    if (c === "*") {
      keys.push(c);
      pattern += tmp[1] === "?" ? "(?:/(.*))?" : "/(.*)";
    } else if (c === ":") {
      o = tmp.indexOf("?", 1);
      ext = tmp.indexOf(".", 1);
      keys.push(tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length));
      pattern += !!~o && !~ext ? "(?:/([^/]+?))?" : "/([^/]+?)";
      if (!!~ext) pattern += (!!~o ? "?" : "") + "\\" + tmp.substring(ext);
    } else {
      pattern += "/" + tmp;
    }
  }
  return {
    keys,
    pattern: new RegExp("^" + pattern + (loose ? "(?=$|/)" : "/?$"), "i")
  };
}
const useBuiltinInsertionEffect = React$1["useInsertionEffect"];
const canUseDOM = !!(typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined");
const useIsomorphicLayoutEffect = canUseDOM ? reactExports.useLayoutEffect : reactExports.useEffect;
const useInsertionEffect = useBuiltinInsertionEffect || useIsomorphicLayoutEffect;
const useEvent = (fn) => {
  const ref = reactExports.useRef([fn, (...args) => ref[0](...args)]).current;
  useInsertionEffect(() => {
    ref[0] = fn;
  });
  return ref[1];
};
const eventPopstate = "popstate";
const eventPushState = "pushState";
const eventReplaceState = "replaceState";
const eventHashchange = "hashchange";
const events = [
  eventPopstate,
  eventPushState,
  eventReplaceState,
  eventHashchange
];
const subscribeToLocationUpdates = (callback) => {
  for (const event of events) {
    addEventListener(event, callback);
  }
  return () => {
    for (const event of events) {
      removeEventListener(event, callback);
    }
  };
};
const useLocationProperty = (fn, ssrFn) => shimExports.useSyncExternalStore(subscribeToLocationUpdates, fn, ssrFn);
const currentSearch = () => location.search;
const useSearch = ({ ssrSearch } = {}) => useLocationProperty(
  currentSearch,
  // != null checks for both null and undefined, but allows empty string ""
  // This allows proper hydration: server renders with ssrSearch="?foo",
  // client hydrates with just <Router /> and reads from location.search
  ssrSearch != null ? () => ssrSearch : currentSearch
);
const currentPathname = () => location.pathname;
const usePathname = ({ ssrPath } = {}) => useLocationProperty(
  currentPathname,
  // != null checks for both null and undefined, but allows empty string ""
  // This allows proper hydration: server renders with ssrPath="/foo",
  // client hydrates with just <Router /> and reads from location.pathname
  ssrPath != null ? () => ssrPath : currentPathname
);
const navigate = (to, { replace = false, state = null } = {}) => history[replace ? eventReplaceState : eventPushState](state, "", to);
const useBrowserLocation = (opts = {}) => [usePathname(opts), navigate];
const patchKey = /* @__PURE__ */ Symbol.for("wouter_v3");
if (typeof history !== "undefined" && typeof window[patchKey] === "undefined") {
  for (const type of [eventPushState, eventReplaceState]) {
    const original = history[type];
    history[type] = function() {
      const result = original.apply(this, arguments);
      const event = new Event(type);
      event.arguments = arguments;
      dispatchEvent(event);
      return result;
    };
  }
  Object.defineProperty(window, patchKey, { value: true });
}
const _relativePath = (base, path) => !path.toLowerCase().indexOf(base.toLowerCase()) ? path.slice(base.length) || "/" : "~" + path;
const baseDefaults = (base = "") => base === "/" ? "" : base;
const absolutePath = (to, base) => to[0] === "~" ? to.slice(1) : baseDefaults(base) + to;
const relativePath = (base = "", path) => _relativePath(unescape(baseDefaults(base)), unescape(path));
const unescape = (str) => {
  try {
    return decodeURI(str);
  } catch (_e) {
    return str;
  }
};
const defaultRouter = {
  hook: useBrowserLocation,
  searchHook: useSearch,
  parser: parse,
  base: "",
  // this option is used to override the current location during SSR
  ssrPath: void 0,
  ssrSearch: void 0,
  // optional context to track render state during SSR
  ssrContext: void 0,
  // customizes how `href` props are transformed for <Link />
  hrefs: (x) => x,
  // wraps navigate calls, useful for view transitions
  aroundNav: (n, t, o) => n(t, o)
};
const RouterCtx = reactExports.createContext(defaultRouter);
const useRouter = () => reactExports.useContext(RouterCtx);
const Params0 = {}, ParamsCtx = reactExports.createContext(Params0);
const useParams = () => reactExports.useContext(ParamsCtx);
const useLocationFromRouter = (router) => {
  const [location2, navigate2] = router.hook(router);
  return [
    relativePath(router.base, location2),
    useEvent(
      (to, opts) => router.aroundNav(navigate2, absolutePath(to, router.base), opts)
    )
  ];
};
const useLocation = () => useLocationFromRouter(useRouter());
const matchRoute = (parser, route, path, loose) => {
  const { pattern, keys } = route instanceof RegExp ? { keys: false, pattern: route } : parser(route || "*", loose);
  const result = pattern.exec(path) || [];
  const [$base, ...matches] = result;
  return $base !== void 0 ? [
    true,
    (() => {
      const groups = keys !== false ? Object.fromEntries(keys.map((key, i) => [key, matches[i]])) : result.groups;
      let obj = { ...matches };
      groups && Object.assign(obj, groups);
      return obj;
    })(),
    // the third value if only present when parser is in "loose" mode,
    // so that we can extract the base path for nested routes
    ...loose ? [$base] : []
  ] : [false, null];
};
const Router = ({ children, ...props }) => {
  const parent_ = useRouter();
  const parent = props.hook ? defaultRouter : parent_;
  let value = parent;
  const [path, search = props.ssrSearch ?? ""] = props.ssrPath?.split("?") ?? [];
  if (path) props.ssrSearch = search, props.ssrPath = path;
  props.hrefs = props.hrefs ?? props.hook?.hrefs;
  props.searchHook = props.searchHook ?? props.hook?.searchHook;
  let ref = reactExports.useRef({}), prev = ref.current, next = prev;
  for (let k in parent) {
    const option = k === "base" ? (
      /* base is special case, it is appended to the parent's base */
      parent[k] + (props[k] ?? "")
    ) : props[k] ?? parent[k];
    if (prev === next && option !== next[k]) {
      ref.current = next = { ...next };
    }
    next[k] = option;
    if (option !== parent[k] || option !== value[k]) value = next;
  }
  return reactExports.createElement(RouterCtx.Provider, { value, children });
};
const h_route = ({ children, component }, params) => {
  if (component) return reactExports.createElement(component, { params });
  return typeof children === "function" ? children(params) : children;
};
const useCachedParams = (value) => {
  let prev = reactExports.useRef(Params0);
  const curr = prev.current;
  return prev.current = // Update cache if number of params changed or any value changed
  Object.keys(value).length !== Object.keys(curr).length || Object.entries(value).some(([k, v]) => v !== curr[k]) ? value : curr;
};
const Route = ({ path, nest, match, ...renderProps }) => {
  const router = useRouter();
  const [location2] = useLocationFromRouter(router);
  const [matches, routeParams, base] = (
    // `match` is a special prop to give up control to the parent,
    // it is used by the `Switch` to avoid double matching
    match ?? matchRoute(router.parser, path, location2, nest)
  );
  const params = useCachedParams({ ...useParams(), ...routeParams });
  if (!matches) return null;
  const children = base ? reactExports.createElement(Router, { base }, h_route(renderProps, params)) : h_route(renderProps, params);
  return reactExports.createElement(ParamsCtx.Provider, { value: params, children });
};
const Link = reactExports.forwardRef((props, ref) => {
  const router = useRouter();
  const [currentPath, navigate2] = useLocationFromRouter(router);
  const {
    to = "",
    href: targetPath = to,
    onClick: _onClick,
    asChild,
    children,
    className: cls,
    /* eslint-disable no-unused-vars */
    replace,
    state,
    transition,
    /* eslint-enable no-unused-vars */
    ...restProps
  } = props;
  const onClick = useEvent((event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.button !== 0)
      return;
    _onClick?.(event);
    if (!event.defaultPrevented) {
      event.preventDefault();
      navigate2(targetPath, props);
    }
  });
  const href = router.hrefs(
    targetPath[0] === "~" ? targetPath.slice(1) : router.base + targetPath,
    router
    // pass router as a second argument for convinience
  );
  return asChild && reactExports.isValidElement(children) ? reactExports.cloneElement(children, { onClick, href }) : reactExports.createElement("a", {
    ...restProps,
    onClick,
    href,
    // `className` can be a function to apply the class if this link is active
    className: cls?.call ? cls(currentPath === targetPath) : cls,
    children,
    ref
  });
});
const Wrapper$3 = styled.div`
  background: var(--color-background-secondary);
  display: flex;
  padding: 1rem;
  border-radius: 0.5rem;
  line-height: 1.5;
`;
const SeverityIcon = ({ severity, ...props }) => {
  switch (severity) {
    case "info":
      return jsxRuntimeExports.jsx(Info, { ...props });
    case "warning":
      return jsxRuntimeExports.jsx(Warning, { ...props });
  }
};
const Content$3 = styled.div`
  flex-grow: 1;
  display: flex;
  align-items: center;
`;
const Alert = ({ children, severity, ...props }) => {
  return jsxRuntimeExports.jsxs(Wrapper$3, { ...props, children: [jsxRuntimeExports.jsx(SeverityIcon, { severity, style: { marginRight: "1rem", flexShrink: "0" } }), jsxRuntimeExports.jsx(Content$3, { children })] });
};
const Button = styled.button`
  display: flex;
  align-items: center;
  background: transparent;
  border: none;
  border-radius: 0.2rem;
  color: var(--color-text);
  padding: 0.5rem 1rem;
  cursor: pointer;
  height: 2rem;
  outline: none;
  font-size: 0.8rem;

  &:hover {
    background: var(--color-highlight);
  }
  &:active {
    background: ${({ theme }) => Color(theme.secondaryBackgroundColor).lighten(0.1).hex()};
  }
`;
const PrimaryButton = styled(Button)`
  background: var(--color-theme);

  &:hover {
    background: ${({ theme }) => Color(theme.themeColor).darken(0.1).hex()};
  }
  &:active {
    background: ${({ theme }) => Color(theme.themeColor).darken(0.2).hex()};
  }
`;
const CircularProgress = ({ size = "2rem" }) => {
  const theme = useTheme();
  return jsxRuntimeExports.jsx(NinetyRingWithBg, { style: { width: size, height: size }, color: theme.themeColor });
};
const TextArea = styled.textarea`
  display: block;
  appearance: none;
  border: none;
  background: inherit;
  border: 1px solid var(--color-divider);
  border-radius: 0.25rem;
  min-height: 8em;
  padding: 1rem 1rem;
  align-items: center;
  justify-content: center;
  color: inherit;
  font-size: 1rem;
  font-family: inherit;
  outline: none;

  &:focus {
    border-color: var(--color-theme);
  }
`;
const TextField = styled.input`
  display: block;
  appearance: none;
  border: none;
  background: inherit;
  border: 1px solid var(--color-divider);
  border-radius: 0.25rem;
  height: 3rem;
  padding: 0 1rem;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  color: inherit;
  font-size: 1rem;
  font-family: inherit;
  outline: none;

  &:focus {
    border-color: var(--color-theme);
  }
`;
function useAsyncEffect(effect, deps) {
  reactExports.useEffect(() => {
    effect();
  }, deps);
}
var SkipNextIcon_1;
var hasRequiredSkipNextIcon;
function requireSkipNextIcon() {
  if (hasRequiredSkipNextIcon) return SkipNextIcon_1;
  hasRequiredSkipNextIcon = 1;
  function _interopDefault(ex) {
    return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
  }
  var React2 = _interopDefault(requireReact());
  var _extends = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  var objectWithoutProperties = function(obj, keys) {
    var target = {};
    for (var i in obj) {
      if (keys.indexOf(i) >= 0) continue;
      if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
      target[i] = obj[i];
    }
    return target;
  };
  var SkipNextIcon = function SkipNextIcon2(_ref) {
    var _ref$color = _ref.color, color = _ref$color === void 0 ? "currentColor" : _ref$color, _ref$size = _ref.size, size = _ref$size === void 0 ? 24 : _ref$size;
    _ref.children;
    var props = objectWithoutProperties(_ref, ["color", "size", "children"]);
    var className = "mdi-icon " + (props.className || "");
    return React2.createElement(
      "svg",
      _extends({}, props, { className, width: size, height: size, fill: color, viewBox: "0 0 24 24" }),
      React2.createElement("path", { d: "M16,18H18V6H16M6,18L14.5,12L6,6V18Z" })
    );
  };
  var SkipNextIcon$1 = React2.memo ? React2.memo(SkipNextIcon) : SkipNextIcon;
  SkipNextIcon_1 = SkipNextIcon$1;
  return SkipNextIcon_1;
}
var SkipNextIconExports = requireSkipNextIcon();
const SkipNext = /* @__PURE__ */ getDefaultExportFromCjs(SkipNextIconExports);
var SkipPreviousIcon_1;
var hasRequiredSkipPreviousIcon;
function requireSkipPreviousIcon() {
  if (hasRequiredSkipPreviousIcon) return SkipPreviousIcon_1;
  hasRequiredSkipPreviousIcon = 1;
  function _interopDefault(ex) {
    return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
  }
  var React2 = _interopDefault(requireReact());
  var _extends = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  var objectWithoutProperties = function(obj, keys) {
    var target = {};
    for (var i in obj) {
      if (keys.indexOf(i) >= 0) continue;
      if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
      target[i] = obj[i];
    }
    return target;
  };
  var SkipPreviousIcon = function SkipPreviousIcon2(_ref) {
    var _ref$color = _ref.color, color = _ref$color === void 0 ? "currentColor" : _ref$color, _ref$size = _ref.size, size = _ref$size === void 0 ? 24 : _ref$size;
    _ref.children;
    var props = objectWithoutProperties(_ref, ["color", "size", "children"]);
    var className = "mdi-icon " + (props.className || "");
    return React2.createElement(
      "svg",
      _extends({}, props, { className, width: size, height: size, fill: color, viewBox: "0 0 24 24" }),
      React2.createElement("path", { d: "M6,18V6H8V18H6M9.5,12L18,6V18L9.5,12Z" })
    );
  };
  var SkipPreviousIcon$1 = React2.memo ? React2.memo(SkipPreviousIcon) : SkipPreviousIcon;
  SkipPreviousIcon_1 = SkipPreviousIcon$1;
  return SkipPreviousIcon_1;
}
var SkipPreviousIconExports = requireSkipPreviousIcon();
const SkipPrevious = /* @__PURE__ */ getDefaultExportFromCjs(SkipPreviousIconExports);
var debounceExports = requireDebounce();
const debounce = /* @__PURE__ */ getDefaultExportFromCjs(debounceExports);
const debouncedIncrementPlayCount = debounce((cloudSongRepository, songId) => cloudSongRepository.incrementPlayCount(songId), 5e3);
const playSong = ({ songStore, player, cloudSongRepository, synth }) => async (song) => {
  setupSynthIfNeeded(synth);
  await songStore.loadSong(song);
  player.reset();
  player.play();
  try {
    await debouncedIncrementPlayCount(cloudSongRepository, song.id);
  } catch (e) {
    console.error(e);
  }
};
const playSongAt = (indexDelta) => (rootStore) => async () => {
  const { songStore, communitySongStore } = rootStore;
  const currentSong = songStore.currentSong;
  if (currentSong === null) {
    return;
  }
  const index = communitySongStore.songs.findIndex((s) => s.id === currentSong.metadata.id);
  const nextIndex = index + indexDelta < 0 ? communitySongStore.songs.length - 1 : (index + indexDelta) % communitySongStore.songs.length;
  const nextSong = communitySongStore.songs[nextIndex];
  await playSong(rootStore)(nextSong);
};
const playPreviousSong = playSongAt(-1);
const playNextSong = playSongAt(1);
const setupSynthIfNeeded = async (synth) => {
  if (synth.isLoaded) {
    return;
  }
  await synth.setup();
  const soundFont = await SoundFont.loadFromURL("https://cdn.jsdelivr.net/gh/ryohey/signal@4569a31/public/A320U.sf2");
  await synth.loadSoundFont(soundFont);
};
const localization = {
  en: {
    profile: "Profile",
    "edit-profile": "Edit Profile",
    "signin-to-edit-profile": "Please sign in to edit your profile",
    "sign-in": "Sign In",
    "sign-out": "Sign Out",
    "success-sign-in": "Successfully signed in",
    "display-name": "Display Name",
    bio: "Bio",
    tracks: "Tracks",
    "recent-tracks": "Recent Tracks",
    "play-count": "plays",
    "play-count-1": "play",
    "song-not-found": "Song not found",
    download: "Download",
    share: "Share",
    save: "Save",
    close: "Close",
    cut: "Cut",
    copy: "Copy",
    copied: "Copied",
    "created-at": "Created at",
    "published-at": "Published at",
    "updated-at": "Updated at",
    "user-not-found": "User not found",
    "create-new": "Create New",
    "untitled-song": "Untitled song"
  },
  fr: {
    profile: "Profil",
    "edit-profile": "Modifier le Profil",
    "signin-to-edit-profile": "Veuillez vous connecter pour modifier votre profil",
    "sign-in": "Se connecter",
    "sign-out": "Se déconnecter",
    "success-sign-in": "Connection réussie",
    "display-name": "Nom Public",
    bio: "Bio",
    tracks: "Pistes",
    "recent-tracks": "Pistes Récentes",
    "play-count": "lectures",
    "play-count-1": "lecture",
    "song-not-found": "Musique introuvable",
    download: "Télécharger",
    share: "Partager",
    save: "Enregistrer",
    close: "Fermer",
    cut: "Couper",
    copy: "Copier",
    copied: "Copié",
    "created-at": "Créé à",
    "published-at": "Publié à",
    "updated-at": "Mis à jour",
    "user-not-found": "Utilisateur introuvable",
    "create-new": "Créer une nouvelle musique",
    "untitled-song": "Musique sans titre"
  },
  ja: {
    profile: "プロフィール",
    "edit-profile": "プロフィールを編集",
    "signin-to-edit-profile": "プロフィールを編集するにはサインインしてください",
    "sign-in": "サインイン",
    "sign-out": "サインアウト",
    "success-sign-in": "サインインに成功しました",
    "display-name": "表示名",
    bio: "自己紹介",
    tracks: "トラック",
    "recent-tracks": "最近の曲",
    "play-count": "回再生",
    "play-count-1": "回再生",
    "song-not-found": "曲が見つかりません",
    download: "ダウンロード",
    share: "共有",
    save: "保存",
    close: "閉じる",
    cut: "Cut",
    copy: "コピー",
    copied: "コピーしました",
    "created-at": "作成日 ",
    "published-at": "公開日 ",
    "updated-at": "更新日 ",
    "user-not-found": "ユーザーが見つかりません",
    "create-new": "新規作成",
    "untitled-song": "無題の楽曲"
  },
  "zh-Hans": {
    profile: "Profile",
    "edit-profile": "Edit Profile",
    "signin-to-edit-profile": "Please sign in to edit your profile",
    "sign-in": "登录",
    "sign-out": "Sign Out",
    "success-sign-in": "登录成功",
    "display-name": "Display Name",
    bio: "Bio",
    tracks: "Tracks",
    "recent-tracks": "Recent Tracks",
    "play-count": "plays",
    "play-count-1": "play",
    "song-not-found": "Song not found",
    download: "Download",
    share: "Share",
    save: "Save",
    close: "关闭",
    cut: "Cut",
    copy: "拷贝",
    copied: "Copied",
    "created-at": "Created at",
    "published-at": "Published at",
    "updated-at": "Updated at",
    "user-not-found": "User not found",
    "create-new": "Create New",
    "untitled-song": "未命名"
  },
  "zh-Hant": {
    profile: "個人資訊",
    "edit-profile": "編輯個人資訊",
    "signin-to-edit-profile": "登入以編輯個人資訊",
    "sign-in": "登入",
    "sign-out": "登出",
    "success-sign-in": "登入成功",
    "display-name": "顯示名稱",
    bio: "自我介紹",
    tracks: "音軌",
    "recent-tracks": "最近的曲目",
    "play-count": "plays",
    "play-count-1": "play",
    "song-not-found": "Song not found",
    download: "Download",
    share: "Share",
    save: "儲存",
    close: "關閉",
    cut: "Cut",
    copy: "複製",
    copied: "Copied",
    "created-at": "Created at",
    "published-at": "Published at",
    "updated-at": "Updated at",
    "user-not-found": "User not found",
    "create-new": "Create New",
    "untitled-song": "未命名"
  },
  sk: {
    profile: "Profil",
    "edit-profile": "Upraviť profil",
    "signin-to-edit-profile": "Prihláste sa na úpravu svojho profilu",
    "sign-in": "Prihlásiť sa",
    "sign-out": "Odhlásiť sa",
    "success-sign-in": "Úspešne prihlásený",
    "display-name": "Zobrazované meno",
    bio: "Životopis",
    tracks: "Skladby",
    "recent-tracks": "Nedávne skladby",
    "play-count": "prehraní",
    "play-count-1": "prehranie",
    "song-not-found": "Skladba nenájdená",
    download: "Stiahnuť",
    share: "Zdieľať",
    save: "Uložiť",
    close: "Zatvoriť",
    cut: "Vystrihnúť",
    copy: "Kopírovať",
    copied: "Skopírované",
    "created-at": "Vytvorené",
    "published-at": "Publikované",
    "updated-at": "Aktualizované",
    "user-not-found": "Používateľ nenájdený",
    "create-new": "Vytvoriť nové",
    "untitled-song": "Nepomenovaná skladba"
  }
};
const { useLocalization, Localized } = createLocalization(localization, "en", [
  [/^fr/, "fr"],
  [/^sk/, "sk"],
  [/^zh-Hans/, "zh-Hans"],
  [/^zh-Hant/, "zh-Hant"],
  [/^zh$/, "zh-Hans"],
  [/^zh-TW$/, "zh-Hant"],
  [/^zh-HK$/, "zh-Hant"],
  [/^zh-MO$/, "zh-Hant"],
  [/^zh-CN$/, "zh-Hans"],
  [/^zh-SG$/, "zh-Hans"]
]);
styled.img`
  border: 1px var(--color-divider) solid;
  border-radius: 999px;
  width: 2rem;
  height: 2rem;
  margin-right: 0.5rem;
`;
const Wrapper$2 = styled.div`
  display: flex;
  align-items: center;
  flex-grow: 1;
  width: 15rem;
  flex-shrink: 0;
`;
const Author$1 = styled.a`
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
  font-size: 90%;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;
const Title$1 = styled.a`
  color: var(--color-text);
  display: block;
  font-weight: 600;
  font-size: 130%;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;
const BottomPlayerSong = ({ song }) => {
  return jsxRuntimeExports.jsx(Wrapper$2, { children: jsxRuntimeExports.jsxs("div", { children: [jsxRuntimeExports.jsx(Link, { href: `/songs/${song.id}`, style: { color: "currentColor", textDecoration: "none" }, children: jsxRuntimeExports.jsx(Title$1, { children: song.name.length > 0 ? song.name : jsxRuntimeExports.jsx(Localized, { name: "untitled-song" }) }) }), song.user && jsxRuntimeExports.jsx(Link, { href: `/users/${song.user.id}`, style: { color: "currentColor", textDecoration: "none" }, children: jsxRuntimeExports.jsx(Author$1, { children: song.user.name }) })] }) });
};
const CircleButton = styled.div`
  --webkit-appearance: none;
  outline: none;
  border: none;
  border-radius: 100%;
  margin: 0.25rem;
  padding: 0.4rem;
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background: var(--color-highlight);
  }

  svg {
    width: 1.2rem;
    height: 1.2rem;
  }
`;
const StyledButton$1 = styled(CircleButton)`
  background: var(--color-theme);

  &:hover {
    background: var(--color-theme);
    opacity: 0.8;
  }

  &.active {
    background: var(--color-theme);
  }
`;
const PlayButton$1 = ({ onMouseDown, isPlaying }) => {
  return jsxRuntimeExports.jsx(StyledButton$1, { id: "button-play", onMouseDown, className: isPlaying ? "active" : void 0, children: isPlaying ? jsxRuntimeExports.jsx(Pause, {}) : jsxRuntimeExports.jsx(PlayArrow, {}) });
};
const Wrapper$1 = styled.div`
  border-top: 1px solid var(--color-divider);
  padding: 1rem 0;
`;
const Inner$1 = styled.div`
  width: 80%;
  max-width: 60rem;
  margin: 0 auto;
  display: flex;
  align-items: center;
`;
const BottomPlayer = observer(() => {
  const rootStore = useStores();
  const { player, songStore: { currentSong } } = rootStore;
  const toast = useToast();
  const onClickPlay = () => {
    player.isPlaying ? player.stop() : player.play();
  };
  const onClickPrevious = () => {
    try {
      playPreviousSong(rootStore)();
    } catch (e) {
      toast.error(`Failed to play: ${e.message}`);
    }
  };
  const onClickNext = () => {
    try {
      playNextSong(rootStore)();
    } catch (e) {
      toast.error(`Failed to play: ${e.message}`);
    }
  };
  return jsxRuntimeExports.jsx(Wrapper$1, { children: jsxRuntimeExports.jsxs(Inner$1, { children: [jsxRuntimeExports.jsx(CircleButton, { onClick: onClickPrevious, children: jsxRuntimeExports.jsx(SkipPrevious, {}) }), jsxRuntimeExports.jsx(PlayButton$1, { isPlaying: player.isPlaying, onMouseDown: onClickPlay }), jsxRuntimeExports.jsx(CircleButton, { onClick: onClickNext, style: { marginRight: "1rem" }, children: jsxRuntimeExports.jsx(SkipNext, {}) }), currentSong && jsxRuntimeExports.jsx(BottomPlayerSong, { song: currentSong.metadata })] }) });
});
var PlusIcon_1;
var hasRequiredPlusIcon;
function requirePlusIcon() {
  if (hasRequiredPlusIcon) return PlusIcon_1;
  hasRequiredPlusIcon = 1;
  function _interopDefault(ex) {
    return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
  }
  var React2 = _interopDefault(requireReact());
  var _extends = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  var objectWithoutProperties = function(obj, keys) {
    var target = {};
    for (var i in obj) {
      if (keys.indexOf(i) >= 0) continue;
      if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
      target[i] = obj[i];
    }
    return target;
  };
  var PlusIcon2 = function PlusIcon3(_ref) {
    var _ref$color = _ref.color, color = _ref$color === void 0 ? "currentColor" : _ref$color, _ref$size = _ref.size, size = _ref$size === void 0 ? 24 : _ref$size;
    _ref.children;
    var props = objectWithoutProperties(_ref, ["color", "size", "children"]);
    var className = "mdi-icon " + (props.className || "");
    return React2.createElement(
      "svg",
      _extends({}, props, { className, width: size, height: size, fill: color, viewBox: "0 0 24 24" }),
      React2.createElement("path", { d: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" })
    );
  };
  var PlusIcon$1 = React2.memo ? React2.memo(PlusIcon2) : PlusIcon2;
  PlusIcon_1 = PlusIcon$1;
  return PlusIcon_1;
}
var PlusIconExports = requirePlusIcon();
const PlusIcon = /* @__PURE__ */ getDefaultExportFromCjs(PlusIconExports);
const SvgLogoWhite = (props) => /* @__PURE__ */ reactExports.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: 449, height: 120, fill: "none", ...props }, /* @__PURE__ */ reactExports.createElement("g", { clipPath: "url(#logo-white_svg__a)" }, /* @__PURE__ */ reactExports.createElement("path", { fill: "#fff", d: "M167.961 76.653q3.502 2.677 6.695 4.017t6.489 1.339q3.399 0 4.944-1.133t1.545-3.193q0-1.236-.927-2.163-.824-1.03-2.369-1.854-1.442-.825-3.296-1.442-1.854-.72-3.811-1.545a48 48 0 0 1-4.738-2.163 21 21 0 0 1-4.326-2.987 15.9 15.9 0 0 1-3.193-4.223q-1.236-2.472-1.236-5.665 0-3.502 1.339-6.489a14.4 14.4 0 0 1 4.017-5.047q2.575-2.06 6.18-3.193 3.604-1.236 8.034-1.236 5.87 0 10.3 2.06 4.43 1.957 7.725 4.429l-6.798 9.064q-2.781-2.06-5.459-3.193t-5.356-1.133q-5.768 0-5.768 4.017 0 1.236.824 2.163.823.824 2.163 1.545 1.442.72 3.193 1.442 1.854.618 3.811 1.339a43 43 0 0 1 4.841 2.163 17.6 17.6 0 0 1 4.429 2.884q2.06 1.751 3.296 4.326 1.236 2.472 1.236 5.974t-1.339 6.489-4.017 5.253q-2.678 2.163-6.592 3.502-3.914 1.236-9.064 1.236-5.047 0-10.403-1.957-5.253-1.957-9.167-5.15zm52.464-43.26q-3.811 0-6.283-2.163-2.472-2.265-2.472-5.768t2.472-5.665q2.472-2.163 6.283-2.163 3.914 0 6.283 2.163 2.472 2.163 2.472 5.665t-2.472 5.768q-2.369 2.163-6.283 2.163m-7.519 7.519h15.141V92h-15.141zm37.736 57.474q0 2.885 3.09 4.326 3.09 1.545 8.24 1.545t8.446-1.854q3.296-1.751 3.296-4.429 0-2.37-2.06-3.193-1.957-.824-5.768-.824h-5.253q-2.678 0-4.326-.206-1.648-.103-2.884-.412-2.781 2.472-2.781 5.047m-12.463 2.369q0-6.18 7.313-10.3v-.412a11.5 11.5 0 0 1-3.399-3.399q-1.34-2.06-1.339-5.253 0-2.781 1.648-5.253a15.5 15.5 0 0 1 4.12-4.326V71.4q-2.678-1.854-4.841-5.253-2.06-3.502-2.06-8.034 0-4.635 1.751-8.034 1.75-3.502 4.635-5.768 2.987-2.37 6.798-3.502a27.7 27.7 0 0 1 7.931-1.133q4.532 0 7.931 1.236h18.643v11.021h-8.137q.721 1.133 1.133 2.884.515 1.751.515 3.811 0 4.43-1.545 7.725a14.9 14.9 0 0 1-4.326 5.356q-2.678 2.06-6.386 3.09-3.605 1.03-7.828 1.03-2.986 0-6.18-1.03-1.03.825-1.442 1.648-.412.824-.412 2.163 0 1.957 1.648 2.884 1.75.927 6.077.927h8.24q9.476 0 14.42 3.09 5.047 2.987 5.047 9.888 0 4.017-2.06 7.313-1.957 3.4-5.665 5.768-3.708 2.472-8.961 3.811-5.253 1.442-11.845 1.442-4.532 0-8.446-.824-3.811-.721-6.798-2.266-2.884-1.545-4.532-4.017t-1.648-5.871m22.557-34.093q2.986 0 4.944-2.06 2.06-2.163 2.06-6.489 0-4.017-2.06-6.077-1.958-2.163-4.944-2.163-2.987 0-5.047 2.06-1.957 2.06-1.957 6.18 0 4.326 1.957 6.489 2.06 2.06 5.047 2.06m35.141-25.75h12.36l1.03 6.489h.412a39.3 39.3 0 0 1 7.21-5.356q3.914-2.37 9.167-2.369 8.343 0 12.051 5.459 3.811 5.46 3.811 15.141V92h-15.141V62.233q0-5.562-1.545-7.622-1.441-2.06-4.738-2.06-2.883 0-4.944 1.339-2.06 1.236-4.532 3.605V92h-15.141zm55.545 36.874q0-8.034 6.798-12.566t21.939-6.077q-.207-3.399-2.06-5.356-1.855-2.06-5.974-2.06-3.297 0-6.592 1.236-3.296 1.236-7.004 3.399l-5.356-9.991a54 54 0 0 1 10.3-4.841q5.458-1.854 11.536-1.854 9.887 0 15.038 5.665 5.253 5.562 5.253 17.407V92h-12.36l-1.133-5.253h-.309q-3.296 2.884-7.004 4.738-3.606 1.75-7.931 1.751-3.502 0-6.283-1.236-2.781-1.133-4.738-3.193a16.7 16.7 0 0 1-3.09-4.944q-1.03-2.781-1.03-6.077m14.42-1.133q0 2.472 1.545 3.708 1.647 1.133 4.326 1.133t4.532-1.133 3.914-3.193v-8.961q-8.137 1.133-11.227 3.296t-3.09 5.15m42.454-56.856h15.141V92h-15.141z" }), /* @__PURE__ */ reactExports.createElement("circle", { cx: 68.5, cy: 60.5, r: 44.5, stroke: "#fff", strokeWidth: 10 }), /* @__PURE__ */ reactExports.createElement("circle", { cx: 47.323, cy: 73.019, r: 7.323, fill: "#fff" }), /* @__PURE__ */ reactExports.createElement("circle", { cx: 68.424, cy: 81.778, r: 7.323, fill: "#fff" }), /* @__PURE__ */ reactExports.createElement("ellipse", { cx: 89.987, cy: 73.019, fill: "#fff", rx: 7.886, ry: 7.323 })), /* @__PURE__ */ reactExports.createElement("defs", null, /* @__PURE__ */ reactExports.createElement("clipPath", { id: "logo-white_svg__a" }, /* @__PURE__ */ reactExports.createElement("path", { fill: "#fff", d: "M0 0h449v120H0z" }))));
const StyledContent$1 = styled(Content2)`
  background: var(--color-background-secondary);
  border-radius: 0.5rem;
  box-shadow: 0 1rem 3rem var(--color-shadow);
  border: 1px solid var(--color-background);
  margin: 0 1rem;
  padding: 0.5rem 0;
`;
const List = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;
const Menu = ({ trigger, open, onOpenChange, children }) => {
  return jsxRuntimeExports.jsxs(Root2, { open, onOpenChange, children: [jsxRuntimeExports.jsx(Trigger, { asChild: true, children: trigger }), jsxRuntimeExports.jsx(Portal2, { children: jsxRuntimeExports.jsx(StyledContent$1, { children: jsxRuntimeExports.jsx(List, { children }) }) })] });
};
const StyledLi = styled.li`
  font-size: 0.8rem;
  color: ${({ theme, disabled }) => disabled ? theme.secondaryTextColor : theme.textColor};
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  pointer-events: ${({ disabled }) => disabled ? "none" : "auto"};
  cursor: pointer;

  &:hover {
    background: ${({ theme, disabled }) => disabled ? "transparent" : theme.highlightColor};
  }
`;
const MenuItem = ({ children, ...props }) => jsxRuntimeExports.jsx(StyledLi, { ...props, children });
styled.hr`
  border: none;
  border-top: 1px solid var(--color-divider);
`;
const IconStyle = {
  width: "1.3rem",
  height: "1.3rem",
  fill: "currentColor"
};
const Tab = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center; 
  padding: 0 0.5rem;
  height: 2rem;
  font-size: 0.75rem;
  border-radius: 0.2rem;
  color: var(--color-text-secondary);
  cursor: pointer;

  &:hover {
    background: var(--color-highlight);
  }
  &:active {
    background: ${({ theme }) => Color(theme.secondaryBackgroundColor).lighten(0.1).hex()};
  }

  a {
    color: inherit;
    text-decoration: none;
  }
}
`;
const TabTitle = styled.span`
  margin-left: 0.5rem;

  @media (max-width: 850px) {
    display: none;
  }
`;
const UserButton = observer(() => {
  const ref = reactExports.useRef(null);
  const { authStore: { authUser, user }, rootViewStore } = useStores();
  const [_, navigate2] = useLocation();
  const onClickSignIn = () => {
    rootViewStore.openSignInDialog = true;
  };
  const onClickSignOut = async () => {
    await auth.signOut();
  };
  if (authUser === null) {
    return jsxRuntimeExports.jsxs(Tab, { onClick: onClickSignIn, children: [jsxRuntimeExports.jsx(AccountCircle, { style: IconStyle }), jsxRuntimeExports.jsx(TabTitle, { children: jsxRuntimeExports.jsx(Localized, { name: "sign-in" }) })] });
  }
  return jsxRuntimeExports.jsxs(Menu, { trigger: jsxRuntimeExports.jsxs(Tab, { ref, children: [jsxRuntimeExports.jsx(AccountCircle, { style: IconStyle }), jsxRuntimeExports.jsx(TabTitle, { children: user?.name ?? authUser.displayName })] }), children: [jsxRuntimeExports.jsx(MenuItem, { onClick: () => navigate2(`/users/${authUser.uid}`), children: jsxRuntimeExports.jsx(Localized, { name: "profile" }) }), jsxRuntimeExports.jsx(MenuItem, { onClick: () => navigate2("/profile"), children: jsxRuntimeExports.jsx(Localized, { name: "edit-profile" }) }), jsxRuntimeExports.jsx(MenuItem, { onClick: onClickSignOut, children: jsxRuntimeExports.jsx(Localized, { name: "sign-out" }) })] });
});
const Container$1 = styled.div`
  width: 80%;
  max-width: 60rem;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
const LogoWrapper = styled.div`
  display: flex;
  cursor: pointer;

  &:hover {
    opacity: 0.7;
  }
`;
const NavigationWrapper = styled.div`
  display: flex;
  align-items: center;
  height: 5rem;
`;
const Right = styled.div`
  display: flex;
  align-items: center;
`;
const CreateButton = styled.a`
  display: flex;
  align-items: center;
  background: transparent;
  border: none;
  border-radius: 0.2rem;
  color: var(--color-text);
  padding: 0 0.5rem;
  cursor: pointer;
  height: 2rem;
  outline: none;
  font-size: 0.8rem;
  text-decoration: none;
  font-weight: 600;
  margin-right: 1rem;

  &:hover {
    background: var(--color-highlight);
  }
  &:active {
    background: ${({ theme }) => Color(theme.secondaryBackgroundColor).lighten(0.1).hex()};
  }
`;
const Navigation = observer(() => {
  return jsxRuntimeExports.jsx(NavigationWrapper, { children: jsxRuntimeExports.jsxs(Container$1, { children: [jsxRuntimeExports.jsx(LogoWrapper, { children: jsxRuntimeExports.jsx(Link, { href: "/home", children: jsxRuntimeExports.jsx(SvgLogoWhite, { width: null, height: 28, viewBox: "16 0 449 120" }) }) }), jsxRuntimeExports.jsxs(Right, { children: [jsxRuntimeExports.jsxs(CreateButton, { href: "/edit", target: "_blank", children: [jsxRuntimeExports.jsx(PlusIcon, { size: "1rem", style: { marginRight: "0.5rem" } }), jsxRuntimeExports.jsx(Localized, { name: "create-new" })] }), jsxRuntimeExports.jsx(UserButton, {})] })] }) });
});
const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;
const Content$2 = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  flex-basis: 0;
  padding-bottom: 2rem;
`;
const Inner = styled.div`
  width: 80%;
  max-width: 60rem;
  margin: 0 auto;
`;
const PageTitle = styled.h1`
  font-size: 2rem;
  margin-top: 2rem;
  margin-bottom: 2rem;
`;
const PageLayout = ({ children }) => {
  return jsxRuntimeExports.jsxs(Container, { children: [jsxRuntimeExports.jsx(Navigation, {}), jsxRuntimeExports.jsx(Content$2, { children: jsxRuntimeExports.jsx(Inner, { children }) }), jsxRuntimeExports.jsx(BottomPlayer, {})] });
};
const Form$1 = styled.div`
  display: flex;
  flex-direction: column;
`;
const Label = styled.label`
  font-size: 1rem;
  margin-bottom: 0.5rem;
  margin-top: 1rem;
`;
const Action$1 = styled.div`
  margin-top: 1rem;
`;
const EditProfilePage = observer(() => {
  const { authStore: { authUser }, userRepository } = useStores();
  const [isLoading, setIsLoading] = reactExports.useState(true);
  const [name, setName] = reactExports.useState("");
  const [bio, setBio] = reactExports.useState("");
  const toast = useToast();
  useAsyncEffect(async () => {
    if (authUser) {
      try {
        const user = await userRepository.getCurrentUser();
        if (user !== null) {
          setName(user.name);
          setBio(user.bio);
        } else {
          const newUserData = {
            name: authUser.displayName ?? "",
            bio: ""
          };
          await userRepository.create(newUserData);
          setName(newUserData.name);
          setBio(newUserData.bio);
        }
        setIsLoading(false);
      } catch (e) {
        toast.error(`Failed to load user profile: ${e?.message}`);
      }
    }
  }, [authUser]);
  const onClickSave = async () => {
    try {
      await userRepository.update({
        name,
        bio
      });
      toast.success("Successfully updated profile");
    } catch (e) {
      toast.error(`Failed to update profile: ${e?.message}`);
    }
  };
  if (!authUser) {
    return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(PageTitle, { children: jsxRuntimeExports.jsx(Localized, { name: "edit-profile" }) }), jsxRuntimeExports.jsx(Alert, { severity: "warning", children: jsxRuntimeExports.jsx(Localized, { name: "signin-to-edit-profile" }) })] });
  }
  if (isLoading) {
    return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(PageTitle, { children: jsxRuntimeExports.jsx(Localized, { name: "edit-profile" }) }), jsxRuntimeExports.jsx(CircularProgress, {})] });
  }
  return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(PageTitle, { children: jsxRuntimeExports.jsx(Localized, { name: "edit-profile" }) }), jsxRuntimeExports.jsxs(Form$1, { children: [jsxRuntimeExports.jsx(Label, { children: jsxRuntimeExports.jsx(Localized, { name: "display-name" }) }), jsxRuntimeExports.jsx(TextField, { type: "text", value: name, onChange: (e) => {
    setName(e.target.value);
  } }), jsxRuntimeExports.jsx(Label, { children: jsxRuntimeExports.jsx(Localized, { name: "bio" }) }), jsxRuntimeExports.jsx(TextArea, { value: bio, onChange: (e) => {
    setBio(e.target.value);
  } }), jsxRuntimeExports.jsx(Action$1, { children: jsxRuntimeExports.jsx(PrimaryButton, { onClick: onClickSave, children: jsxRuntimeExports.jsx(Localized, { name: "save" }) }) })] })] });
});
const formatter = new Intl.RelativeTimeFormat(void 0, {
  numeric: "auto"
});
const DIVISIONS = [
  { amount: 60, name: "seconds" },
  { amount: 60, name: "minutes" },
  { amount: 24, name: "hours" },
  { amount: 7, name: "days" },
  { amount: 4.34524, name: "weeks" },
  { amount: 12, name: "months" },
  { amount: Number.POSITIVE_INFINITY, name: "years" }
];
function formatTimeAgo(date) {
  let duration = (date.getTime() - Date.now()) / 1e3;
  for (let i = 0; i <= DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
  throw new Error("");
}
const Content$1 = styled.div`
  display: flex;
  align-items: center;
  flex-grow: 1;
`;
const Username = styled.div`
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
  font-size: 90%;
`;
const Title = styled.div`
  word-break: break-all;
  font-weight: 600;
  font-size: 130%;
`;
const PlayButtonWrapper = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  align-content: center;
  justify-content: center;
  margin-right: 0.5rem;

  .arrow {
    display: none;
  }
  .circle {
    display: block;
    width: 0.5rem;
    opacity: 0.2;
  }
`;
const PlayButton = ({ isPlaying }) => {
  return jsxRuntimeExports.jsx(PlayButtonWrapper, { children: isPlaying ? jsxRuntimeExports.jsx(Pause, {}) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [jsxRuntimeExports.jsx(Circle, { className: "circle" }), jsxRuntimeExports.jsx(PlayArrow, { className: "arrow" })] }) });
};
const Wrapper = styled.div`
  display: flex;
  padding: 0.5rem 0;
  cursor: pointer;
  border-radius: 0.5rem;

  &:hover {
    background: var(--color-highlight);

    .arrow {
      display: block;
    }
    .circle {
      display: none;
    }
  }
`;
const PlayCount$1 = styled.div`
  display: flex;
  align-items: center;
  margin-right: 1rem;
  color: var(--color-text-secondary);
`;
const Time = styled.div`
  display: flex;
  align-items: center;
  margin-right: 1rem;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  min-width: 4rem;
`;
const Tag = styled.div`
  display: flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  border-radius: 0.5rem;
  background: var(--color-highlight);
  color: var(--color-text);
  font-size: 90%;
  margin-right: 0.5rem;
`;
const Labels = styled.div`
  display: flex;
  flex-direction: column;
  margin-right: 1rem;
`;
const SongListItem = observer(({ song }) => {
  const rootStore = useStores();
  const { player, songStore: { currentSong } } = rootStore;
  const toast = useToast();
  const isPlaying = player.isPlaying && currentSong?.metadata.id === song.id;
  const onClick = () => {
    if (player.isPlaying && currentSong?.metadata.id === song.id) {
      player.stop();
    } else {
      try {
        playSong(rootStore)(song);
      } catch (e) {
        toast.error(`Failed to play: ${e.message}`);
      }
    }
  };
  return jsxRuntimeExports.jsxs(Wrapper, { onClick, children: [jsxRuntimeExports.jsx(PlayButton, { isPlaying }), jsxRuntimeExports.jsxs(Content$1, { children: [jsxRuntimeExports.jsxs(Labels, { children: [jsxRuntimeExports.jsx(Title, { children: song.name.length > 0 ? song.name : jsxRuntimeExports.jsx(Localized, { name: "untitled-song" }) }), jsxRuntimeExports.jsx(Username, { children: song.user?.name })] }), !song.isPublic && jsxRuntimeExports.jsx(Tag, { children: "Private" })] }), jsxRuntimeExports.jsxs(PlayCount$1, { children: [jsxRuntimeExports.jsx(PlayArrow, { size: 14, style: { marginRight: "0.25rem" } }), song.playCount ?? 0] }), jsxRuntimeExports.jsx(Time, { children: formatTimeAgo(song.updatedAt) })] });
});
const SongList = observer(({ songs }) => {
  if (songs.length === 0) {
    return jsxRuntimeExports.jsx("div", { children: "No songs" });
  }
  return jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: songs.map((song) => jsxRuntimeExports.jsx(SongListItem, { song }, song.id)) });
});
const RecentSongList = observer(() => {
  const rootStore = useStores();
  const { communitySongStore, cloudSongRepository } = rootStore;
  const toast = useToast();
  const [isLoading, setIsLoading] = reactExports.useState(true);
  const [songs, setSongs] = reactExports.useState([]);
  useAsyncEffect(async () => {
    try {
      const songs2 = await cloudSongRepository.getPublicSongs();
      communitySongStore.songs = songs2;
      setSongs(songs2);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);
  if (isLoading) {
    return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [jsxRuntimeExports.jsx(CircularProgress, {}), " Loading..."] });
  }
  return jsxRuntimeExports.jsx(SongList, { songs });
});
const HomePage = () => {
  return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(PageTitle, { children: jsxRuntimeExports.jsx(Localized, { name: "recent-tracks" }) }), jsxRuntimeExports.jsx(RecentSongList, {})] });
};
var DownloadIcon_1;
var hasRequiredDownloadIcon;
function requireDownloadIcon() {
  if (hasRequiredDownloadIcon) return DownloadIcon_1;
  hasRequiredDownloadIcon = 1;
  function _interopDefault(ex) {
    return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
  }
  var React2 = _interopDefault(requireReact());
  var _extends = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  var objectWithoutProperties = function(obj, keys) {
    var target = {};
    for (var i in obj) {
      if (keys.indexOf(i) >= 0) continue;
      if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
      target[i] = obj[i];
    }
    return target;
  };
  var DownloadIcon2 = function DownloadIcon3(_ref) {
    var _ref$color = _ref.color, color = _ref$color === void 0 ? "currentColor" : _ref$color, _ref$size = _ref.size, size = _ref$size === void 0 ? 24 : _ref$size;
    _ref.children;
    var props = objectWithoutProperties(_ref, ["color", "size", "children"]);
    var className = "mdi-icon " + (props.className || "");
    return React2.createElement(
      "svg",
      _extends({}, props, { className, width: size, height: size, fill: color, viewBox: "0 0 24 24" }),
      React2.createElement("path", { d: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" })
    );
  };
  var DownloadIcon$1 = React2.memo ? React2.memo(DownloadIcon2) : DownloadIcon2;
  DownloadIcon_1 = DownloadIcon$1;
  return DownloadIcon_1;
}
var DownloadIconExports = requireDownloadIcon();
const DownloadIcon = /* @__PURE__ */ getDefaultExportFromCjs(DownloadIconExports);
var ShareIcon_1;
var hasRequiredShareIcon;
function requireShareIcon() {
  if (hasRequiredShareIcon) return ShareIcon_1;
  hasRequiredShareIcon = 1;
  function _interopDefault(ex) {
    return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
  }
  var React2 = _interopDefault(requireReact());
  var _extends = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  var objectWithoutProperties = function(obj, keys) {
    var target = {};
    for (var i in obj) {
      if (keys.indexOf(i) >= 0) continue;
      if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
      target[i] = obj[i];
    }
    return target;
  };
  var ShareIcon2 = function ShareIcon3(_ref) {
    var _ref$color = _ref.color, color = _ref$color === void 0 ? "currentColor" : _ref$color, _ref$size = _ref.size, size = _ref$size === void 0 ? 24 : _ref$size;
    _ref.children;
    var props = objectWithoutProperties(_ref, ["color", "size", "children"]);
    var className = "mdi-icon " + (props.className || "");
    return React2.createElement(
      "svg",
      _extends({}, props, { className, width: size, height: size, fill: color, viewBox: "0 0 24 24" }),
      React2.createElement("path", { d: "M21,12L14,5V9C7,10 4,15 3,20C5.5,16.5 9,14.9 14,14.9V19L21,12Z" })
    );
  };
  var ShareIcon$1 = React2.memo ? React2.memo(ShareIcon2) : ShareIcon2;
  ShareIcon_1 = ShareIcon$1;
  return ShareIcon_1;
}
var ShareIconExports = requireShareIcon();
const ShareIcon = /* @__PURE__ */ getDefaultExportFromCjs(ShareIconExports);
const StyledButton = styled(CircleButton)`
  background: var(--color-theme);

  &:hover {
    background: var(--color-theme);
    opacity: 0.8;
  }

  &.active {
    background: var(--color-theme);
  }

  svg {
    width: 1.5rem;
    height: 1.5rem;
  }
`;
const BigPlayButton = ({ onMouseDown, isPlaying }) => {
  return jsxRuntimeExports.jsx(StyledButton, { onMouseDown, className: isPlaying ? "active" : void 0, children: isPlaying ? jsxRuntimeExports.jsx(Pause, {}) : jsxRuntimeExports.jsx(PlayArrow, {}) });
};
const overlayShow = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;
const contentShow = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
`;
const StyledOverlay = styled(Overlay)`
  background-color: rgba(0, 0, 0, 0.3);
  position: fixed;
  inset: 0;
  animation: ${overlayShow} 150ms cubic-bezier(0.16, 1, 0.3, 1);
`;
const StyledContent = styled(Content$5)`
  background-color: var(--color-background);
  border-radius: 0.5rem;
  box-shadow: 0 0.5rem 3rem var(--color-shadow);
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin-bottom: 1rem;
  max-width: 30rem;
  max-height: 85vh;
  padding: 1rem;
  animation: ${contentShow} 150ms cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  overflow: hidden;

  &:focus {
    outline: none;
  }
`;
const Dialog = ({ children, style, ...props }) => jsxRuntimeExports.jsx(Root$2, { ...props, children: jsxRuntimeExports.jsxs(Portal, { children: [jsxRuntimeExports.jsx(StyledOverlay, {}), jsxRuntimeExports.jsx(StyledContent, { style, children })] }) });
const DialogTitle = styled.div`
  font-size: 1.25rem;
  color: var(--color-text);
  margin-bottom: 1.5rem;
`;
const DialogContent = styled.div`
  overflow-x: hidden;
  overflow-y: auto;
  margin-bottom: 1rem;
`;
const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;

  & > *:not(:last-child) {
    margin-right: 1rem;
  }
`;
const Form = styled.div`
  display: flex;
  flex-grow: 1;
`;
const Input = styled.input`
  flex-grow: 1;
  border: none;
  border-radius: 0.2rem;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  outline: none;
  margin-right: 0.5rem;
`;
const Action = styled.div``;
const CopyTextForm = ({ text }) => {
  const toast = useToast();
  const localized = useLocalization();
  const onClick = reactExports.useCallback(() => {
    navigator.clipboard.writeText(text);
    toast.success(localized["copied"]);
  }, [text]);
  return jsxRuntimeExports.jsxs(Form, { children: [jsxRuntimeExports.jsx(Input, { type: "text", value: text, readOnly: true, onFocus: (e) => {
    e.target.select();
  } }), jsxRuntimeExports.jsx(Action, { children: jsxRuntimeExports.jsx(PrimaryButton, { onClick, children: jsxRuntimeExports.jsx(Localized, { name: "copy" }) }) })] });
};
const Buttons = styled.div`
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
  grid-gap: 0.5rem;

  & > button:hover {
    opacity: 0.8;
  }
`;
const LinkShare = ({ url, text }) => {
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [jsxRuntimeExports.jsx(CopyTextForm, { text: url }), jsxRuntimeExports.jsxs(Buttons, { children: [jsxRuntimeExports.jsx(TwitterShareButton, { url, title: text, children: jsxRuntimeExports.jsx(XIcon, { size: 32, round: true }) }), jsxRuntimeExports.jsx(FacebookShareButton, { url, children: jsxRuntimeExports.jsx(FacebookIcon, { size: 32, round: true }) }), jsxRuntimeExports.jsx(WhatsappShareButton, { url, title: text, children: jsxRuntimeExports.jsx(WhatsappIcon, { size: 32, round: true }) }), jsxRuntimeExports.jsx(VKShareButton, { url, title: text, children: jsxRuntimeExports.jsx(VKIcon, { size: 32, round: true }) }), jsxRuntimeExports.jsx(WeiboShareButton, { url, title: text, children: jsxRuntimeExports.jsx(WeiboIcon, { size: 32, round: true }) }), jsxRuntimeExports.jsx(EmailShareButton, { url, subject: "Check out this song on signal", children: jsxRuntimeExports.jsx(EmailIcon, { size: 32, round: true }) })] })] });
};
const ShareDialog = observer(({ song, open, onClose }) => {
  useLocalization();
  return jsxRuntimeExports.jsxs(Dialog, { open, onOpenChange: onClose, style: { minWidth: "20rem" }, children: [jsxRuntimeExports.jsx(DialogTitle, { children: jsxRuntimeExports.jsx(Localized, { name: "share" }) }), jsxRuntimeExports.jsx(DialogContent, { children: jsxRuntimeExports.jsx(LinkShare, { url: getCloudSongUrl(song.id), text: `🎶 ${song.name} by ${song.user?.name} from @signalmidi
#midi #signalmidi` }) }), jsxRuntimeExports.jsx(DialogActions, { children: jsxRuntimeExports.jsx(Button, { onClick: onClose, children: jsxRuntimeExports.jsx(Localized, { name: "close" }) }) })] });
});
const getCloudSongUrl = (cloudSongId) => `${window.location.origin}/songs/${cloudSongId}`;
function download(url, name = "noname") {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  download(url, fileName);
  setTimeout(() => {
    return window.URL.revokeObjectURL(url);
  }, 1e3);
}
const SongTitle = styled.h1`
  margin: 0;
  font-size: 300%;
`;
const Author = styled.p`
  color: var(--color-text-secondary);
  margin: 0.25rem 0 0 0;
`;
const AuthorLink = styled.a`
  color: currentColor;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;
const Header = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 2rem;
  margin-top: 4rem;
`;
const HeaderRight = styled.div`
  margin-left: 1rem;
`;
const Content = styled.div``;
const Metadata = styled.div`
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
`;
const Actions = styled.div`
  display: flex;
  margin-bottom: 1rem;
`;
const ActionButton = styled(Button)`
  background: var(--color-background-secondary);
  margin-right: 0.5rem;
`;
const Stats = styled.div`
  margin-bottom: 1rem;
`;
const PlayCount = styled.div`
  display: flex;
  align-items: center;
  margin-right: 1rem;
  color: var(--color-text-secondary);
`;
const SongPage = observer(({ songId }) => {
  const rootStore = useStores();
  const { cloudSongRepository, cloudSongDataRepository, player, songStore: { currentSong } } = rootStore;
  const [isLoading, setIsLoading] = reactExports.useState(true);
  const [song, setSong] = reactExports.useState(null);
  const [error, setError] = reactExports.useState(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = reactExports.useState(false);
  const toast = useToast();
  const isPlaying = player.isPlaying && song !== null && currentSong?.metadata.id === song.id;
  const onClickPlay = () => {
    if (song === null) {
      return;
    }
    if (player.isPlaying && currentSong?.metadata.id === song.id) {
      player.stop();
    } else {
      try {
        playSong(rootStore)(song);
      } catch (e) {
        toast.error(`Failed to play: ${e.message}`);
      }
    }
  };
  const onClickDownload = async () => {
    if (song === null) {
      return;
    }
    const songData = await cloudSongDataRepository.get(song.songDataId);
    const uint8Array = new Uint8Array(songData);
    const blob = new Blob([uint8Array], { type: "application/octet-stream" });
    const sanitizedFileName = song.name.replace(/[\\/:"*?<>|]/g, "_");
    const filename = `${sanitizedFileName}.mid`;
    downloadBlob(blob, filename);
  };
  useAsyncEffect(async () => {
    try {
      const song2 = await cloudSongRepository.get(songId);
      setSong(song2);
      setIsLoading(false);
    } catch (e) {
      setError(e);
    }
  }, [songId]);
  if (isLoading) {
    return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(PageTitle, { children: "Song" }), jsxRuntimeExports.jsx(CircularProgress, {}), " Loading..."] });
  }
  if (error !== null) {
    return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(PageTitle, { children: "Song" }), jsxRuntimeExports.jsxs(Alert, { severity: "warning", children: ["Failed to load song: ", error.message] })] });
  }
  if (song === null) {
    return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(PageTitle, { children: "Song" }), jsxRuntimeExports.jsx(Alert, { severity: "warning", children: jsxRuntimeExports.jsx(Localized, { name: "song-not-found" }) })] });
  }
  return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(Helmet, { children: jsxRuntimeExports.jsx("title", { children: `${song.name} - signal` }) }), jsxRuntimeExports.jsxs(Header, { children: [jsxRuntimeExports.jsx(BigPlayButton, { isPlaying, onMouseDown: onClickPlay }), jsxRuntimeExports.jsxs(HeaderRight, { children: [jsxRuntimeExports.jsx(SongTitle, { style: { marginBottom: 0 }, children: song.name }), song.user && jsxRuntimeExports.jsxs(Author, { children: ["by", " ", jsxRuntimeExports.jsx(Link, { href: `/users/${song.user.id}`, style: { color: "currentColor", textDecoration: "none" }, children: jsxRuntimeExports.jsx(AuthorLink, { children: song.user.name }) })] })] })] }), jsxRuntimeExports.jsxs(Content, { children: [jsxRuntimeExports.jsx(Stats, { children: jsxRuntimeExports.jsxs(PlayCount, { children: [jsxRuntimeExports.jsx(PlayArrow, { size: 14, style: { marginRight: "0.25rem" } }), song.playCount ?? 0, " ", song.playCount === 1 ? jsxRuntimeExports.jsx(Localized, { name: "play-count-1" }) : jsxRuntimeExports.jsx(Localized, { name: "play-count" })] }) }), jsxRuntimeExports.jsxs(Actions, { children: [jsxRuntimeExports.jsxs(ActionButton, { onClick: onClickDownload, children: [jsxRuntimeExports.jsx(DownloadIcon, { size: "1rem", style: { marginRight: "0.5rem" } }), jsxRuntimeExports.jsx(Localized, { name: "download" })] }), jsxRuntimeExports.jsxs(ActionButton, { onClick: () => setIsShareDialogOpen(true), children: [jsxRuntimeExports.jsx(ShareIcon, { size: "1rem", style: { marginRight: "0.5rem" } }), jsxRuntimeExports.jsx(Localized, { name: "share" })] })] }), jsxRuntimeExports.jsxs(Metadata, { children: [jsxRuntimeExports.jsx(Localized, { name: "created-at" }), " ", song.createdAt.toLocaleString()] }), song.publishedAt && jsxRuntimeExports.jsxs(Metadata, { children: [jsxRuntimeExports.jsx(Localized, { name: "published-at" }), " ", song.publishedAt.toLocaleString()] }), jsxRuntimeExports.jsxs(Metadata, { children: [jsxRuntimeExports.jsx(Localized, { name: "updated-at" }), " ", song.updatedAt.toLocaleString()] })] }), jsxRuntimeExports.jsx(ShareDialog, { open: isShareDialogOpen, onClose: () => setIsShareDialogOpen(false), song })] });
});
const UserSongList = observer(({ userId }) => {
  const rootStore = useStores();
  const { communitySongStore, cloudSongRepository, authStore: { authUser } } = rootStore;
  const toast = useToast();
  const [isLoading, setIsLoading] = reactExports.useState(true);
  const [songs, setSongs] = reactExports.useState([]);
  useAsyncEffect(async () => {
    try {
      let songs2;
      if (userId === authUser?.uid) {
        songs2 = await cloudSongRepository.getMySongs();
      } else {
        songs2 = await cloudSongRepository.getPublicSongsByUser(userId);
      }
      communitySongStore.songs = songs2;
      setSongs(songs2);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);
  if (isLoading) {
    return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [jsxRuntimeExports.jsx(CircularProgress, {}), " Loading..."] });
  }
  return jsxRuntimeExports.jsx(SongList, { songs });
});
const Bio = styled.p`
  margin-top: 1rem;
`;
const SectionTitle = styled.h2`
  margin-top: 2rem;
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
`;
const UserPage = observer(({ userId }) => {
  const { userRepository } = useStores();
  const [isLoading, setIsLoading] = reactExports.useState(true);
  const [user, setUser] = reactExports.useState(null);
  const [error, setError] = reactExports.useState(null);
  useAsyncEffect(async () => {
    try {
      const user2 = await userRepository.get(userId);
      setUser(user2);
      setIsLoading(false);
    } catch (e) {
      setError(e);
    }
  }, [userId]);
  if (isLoading) {
    return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(PageTitle, { children: "User" }), jsxRuntimeExports.jsx(CircularProgress, {}), " Loading..."] });
  }
  if (error !== null) {
    return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(PageTitle, { children: "User" }), jsxRuntimeExports.jsxs(Alert, { severity: "warning", children: ["Failed to load user profile: ", error.message] })] });
  }
  if (user === null) {
    return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(PageTitle, { children: "User" }), jsxRuntimeExports.jsx(Alert, { severity: "warning", children: jsxRuntimeExports.jsx(Localized, { name: "user-not-found" }) })] });
  }
  return jsxRuntimeExports.jsxs(PageLayout, { children: [jsxRuntimeExports.jsx(Helmet, { children: jsxRuntimeExports.jsx("title", { children: `${user.name} - signal` }) }), jsxRuntimeExports.jsx(PageTitle, { children: user.name }), jsxRuntimeExports.jsx(Bio, { children: user.bio }), jsxRuntimeExports.jsx(SectionTitle, { children: jsxRuntimeExports.jsx(Localized, { name: "tracks" }) }), jsxRuntimeExports.jsx(UserSongList, { userId })] });
});
const StyledFirebaseAuth = styled(FirebaseAuthUI)`
  ul.firebaseui-idp-list {
    list-style-type: none;
    padding: 0;
  }

  button.firebaseui-idp-button {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-divider);
    background: inherit !important;
    color: inherit;
    min-height: 3rem;
    min-width: 12rem;
    justify-content: center;
    cursor: pointer;

    &:hover {
      background: var(--color-highlight) !important;
    }
  }

  img.firebaseui-idp-icon {
    width: 1.5rem;
  }

  span.firebaseui-idp-icon-wrapper {
    display: flex;
    margin-right: 1rem;
  }

  span.firebaseui-idp-text.firebaseui-idp-text-short {
    display: none;
  }

  li.firebaseui-list-item {
    margin-bottom: 1rem;
    display: flex;
    justify-content: center;
  }
`;
const BetaLabel = styled.span`
  border: 1px solid currentColor;
  font-size: 0.8rem;
  padding: 0.1rem 0.4rem;
  margin-left: 1em;
  color: var(--color-text-secondary);
`;
styled.div`
  margin: 1rem 0 2rem 0;
  line-height: 1.5;
`;
const SignInDialogContent = ({ open, onClose, onSuccess, onFailure }) => {
  return jsxRuntimeExports.jsxs(Dialog, { open, onOpenChange: onClose, style: { minWidth: "20rem" }, children: [jsxRuntimeExports.jsxs(DialogTitle, { children: [jsxRuntimeExports.jsx(Localized, { name: "sign-in" }), jsxRuntimeExports.jsx(BetaLabel, { children: "Beta" })] }), jsxRuntimeExports.jsx(DialogContent, { children: jsxRuntimeExports.jsx(StyledFirebaseAuth, { uiConfig: {
    signInOptions: [
      GoogleAuthProvider.PROVIDER_ID,
      GithubAuthProvider.PROVIDER_ID,
      "apple.com"
    ],
    callbacks: {
      signInSuccessWithAuthResult() {
        onSuccess();
        return false;
      },
      signInFailure: onFailure
    },
    signInFlow: "popup"
  }, firebaseAuth: auth }) }), jsxRuntimeExports.jsx(DialogActions, { children: jsxRuntimeExports.jsx(Button, { onClick: onClose, children: jsxRuntimeExports.jsx(Localized, { name: "close" }) }) })] });
};
const SignInDialog = observer(() => {
  const rootStore = useStores();
  const { rootViewStore, rootViewStore: { openSignInDialog } } = rootStore;
  const toast = useToast();
  const localized = useLocalization();
  const onClose = reactExports.useCallback(() => rootViewStore.openSignInDialog = false, [rootViewStore]);
  const signInSuccessWithAuthResult = async () => {
    rootViewStore.openSignInDialog = false;
    toast.success(localized["success-sign-in"]);
  };
  const signInFailure = (error) => {
    console.warn(error);
  };
  return jsxRuntimeExports.jsx(SignInDialogContent, { open: openSignInDialog, onClose, onSuccess: signInSuccessWithAuthResult, onFailure: signInFailure });
});
const Routes = observer(() => {
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [jsxRuntimeExports.jsx(Route, { path: "/home", component: HomePage }), jsxRuntimeExports.jsx(Route, { path: "/profile", component: EditProfilePage }), jsxRuntimeExports.jsx(Route, { path: "/users/:userId", children: (params) => jsxRuntimeExports.jsx(UserPage, { userId: params.userId }) }), jsxRuntimeExports.jsx(Route, { path: "/songs/:songId", children: (params) => jsxRuntimeExports.jsx(SongPage, { songId: params.songId }) })] });
});
const RootView = observer(() => {
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [jsxRuntimeExports.jsx(Routes, {}), jsxRuntimeExports.jsx(SignInDialog, {})] });
});
const App = () => {
  return jsxRuntimeExports.jsx(StoreContext.Provider, { value: new RootStore(), children: jsxRuntimeExports.jsx(ThemeProvider, { theme: defaultTheme, children: jsxRuntimeExports.jsx(HelmetProvider, { children: jsxRuntimeExports.jsxs(ToastProvider, { component: Toast, children: [jsxRuntimeExports.jsx(GlobalCSS, {}), jsxRuntimeExports.jsx(RootView, {})] }) }) }) });
};
function app() {
  const root = clientExports.createRoot(document.querySelector("#root"));
  root.render(jsxRuntimeExports.jsx(App, {}));
}
app();
//# sourceMappingURL=community-aOh_WcDG.js.map
