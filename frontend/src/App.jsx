import { useState, useCallback, useEffect, useRef } from 'react';

import { useWallet }      from './hooks/useWallet.js';
import { useContract }    from './hooks/useContract.js';
import { useTimer }       from './hooks/useTimer.js';
import { useGame }        from './hooks/useGame.js';
import { useLeaderboard } from './hooks/useLeaderboard.js';
import { usePurchase }    from './hooks/usePurchase.js';
import { usePowerUps }   from './hooks/usePowerUps.js';
import { useGasCheck }    from './hooks/useGasCheck.js';
import { isUserRejection } from './utils/miniPay.js';
import { useToast }       from './components/ui/Toast.jsx';
import { useAudio }       from './hooks/useAudio.js';

import WalletConnect  from './components/screens/WalletConnect.jsx';
import SetUsername    from './components/screens/SetUsername.jsx';
import Home           from './components/screens/Home.jsx';
import Starting       from './components/screens/Starting.jsx';
import Playing        from './components/screens/Playing.jsx';
import Submitting     from './components/screens/Submitting.jsx';
import Result         from './components/screens/Result.jsx';
import SplashScreen   from './components/screens/SplashScreen.jsx';
import HowToPlay     from './components/ui/HowToPlay.jsx';
import LowGasModal   from './components/ui/LowGasModal.jsx';
import LegalModal    from './components/ui/LegalModal.jsx';
import FAQModal      from './components/ui/FAQModal.jsx';

const S = {
  WALLET_CONNECT: 'WALLET_CONNECT',
  SET_USERNAME:   'SET_USERNAME',
  HOME:           'HOME',
  STARTING:       'STARTING',
  PLAYING:        'PLAYING',
  SUBMITTING:     'SUBMITTING',
  RESULT:         'RESULT',
};

export default function App() {
  const [splashDone,  setSplashDone]  = useState(false);
  const [screen,      setScreen]      = useState(S.WALLET_CONNECT);
  const [profile,     setProfile]     = useState(null);
  const [score,       setScore]       = useState(0);
  const [finalScore,  setFinalScore]  = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [resultRank,  setResultRank]  = useState(null);
  const [shop,          setShop]          = useState(null); // 'bomb' | 'expand' | null
  const [sessionStatus, setSessionStatus] = useState('idle'); // 'idle'|'pending'|'confirmed'|'failed'
  const [showTutorial,  setShowTutorial]  = useState(false);
  const [hasPausedGame, setHasPausedGame] = useState(false);
  // Ref so the PLAYING useEffect can skip startEngine when resuming a paused game
  const isResumingRef = useRef(false);
  const [legalModal,    setLegalModal]    = useState(null); // 'terms'|'privacy'|'about'|null
  const [showFAQ,       setShowFAQ]       = useState(false);

  // Refs prevent stale closures in timer/game callbacks
  const screenRef  = useRef(screen);
  const scoreRef   = useRef(0);
  const profileRef = useRef(null);
  useEffect(() => { screenRef.current  = screen;  }, [screen]);
  useEffect(() => { scoreRef.current   = score;   }, [score]);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // ── Hooks ──────────────────────────────────────────────────────────────────

  const { address, walletClient, isMiniPay, connect, connectWithSocial, socialLoading, error: walletError } = useWallet();

  const { hasGas, balanceDisplay, checking: gasChecking, recheckNow } = useGasCheck(address);

  const {
    startGame: startGameTx,
    submitScore: submitScoreTx,
    setUsername: setUsernameTx,
    getProfile,
    getLeaderboard,
    checkUsernameAvailable,
  } = useContract(walletClient, address);

  const { toast, showToast } = useToast();
  const audio = useAudio();
  const { muted, toggleMute } = audio;

  const handleScorePts = useCallback((pts) => {
    setScore((prev) => prev + pts);
  }, []);

  const handleTimerExpire = useCallback(() => {
    if (screenRef.current === S.PLAYING) {
      setFinalScore(scoreRef.current);
      setScreen(S.SUBMITTING);
    }
  }, []);

  // useTimer must come before useGame so addTime is defined when passed in
  const { remaining, startTimer, addTime, stopTimer, pauseTimer, resumeTimer } = useTimer(handleTimerExpire);

  const {
    canvasRef, nextIdx, nextNextIdx, gameOver, containerWidth,
    startEngine, dropFruit, movePointer, stopEngine,
    pauseEngine, resumeEngine,
    activateBomb, expandContainer, triggerTimeFX,
  } = useGame(handleScorePts, showToast, addTime, audio);

  const {
    entries: leaderboard,
    loading: leaderboardLoading,
    refresh: refreshLeaderboard,
  } = useLeaderboard(getLeaderboard);

  const {
    packages,
    balances,
    selectedToken,
    setSelectedToken,
    purchase,
    loading: purchaseLoading,
  } = usePurchase(walletClient, address, addTime);

  const {
    totalBombs,
    totalExpands,
    consumeBomb,
    consumeExpand,
    buyPowerUp,
    powerUpPackages,
    selectedToken:    powerUpToken,
    setSelectedToken: setPowerUpToken,
    loading:          powerUpLoading,
  } = usePowerUps(walletClient, address);

  // ── Load profile after wallet connects ─────────────────────────────────────

  useEffect(() => {
    if (!address) return;
    getProfile(address)
      .then((p) => {
        setProfile(p);
        if (p.username) localStorage.setItem('nk_username', p.username);
        setScreen(p.username ? S.HOME : S.SET_USERNAME);
      })
      .catch(console.error);
  }, [address, getProfile]);

  // ── Show how-to-play the first time the HOME screen appears ───────────────

  useEffect(() => {
    if (screen === S.HOME && !localStorage.getItem('nk_tutorial_seen')) {
      setShowTutorial(true);
    }
  }, [screen]);

  // ── Physics game-over → SUBMITTING ─────────────────────────────────────────

  useEffect(() => {
    if (!gameOver || screenRef.current !== S.PLAYING) return;
    stopTimer();
    setHasPausedGame(false);
    setFinalScore(scoreRef.current);
    setScreen(S.SUBMITTING);
  }, [gameOver, stopTimer]);

  // ── Engine starts the moment the PLAYING screen mounts ────────────────────
  // startEngine() reads window.innerWidth automatically so the canvas fills
  // the full device width without needing to measure the DOM first.

  useEffect(() => {
    if (screen !== S.PLAYING) return;
    // If we're resuming a paused game, engine + timer are already running —
    // just clear the flag and leave everything alone.
    if (isResumingRef.current) {
      isResumingRef.current = false;
      return;
    }
    // Fresh start
    setScore(0);
    scoreRef.current = 0;
    startEngine();
    startTimer();
  }, [screen, startEngine, startTimer]);

  // ── Submit score when SUBMITTING screen appears ─────────────────────────────

  useEffect(() => {
    if (screen !== S.SUBMITTING) return;

    stopEngine();
    const submitted = scoreRef.current;
    // personalBest before this game — used to detect new record client-side
    const prevBest  = profileRef.current?.personalBest ?? 0;

    (async () => {
      try {
        await submitScoreTx(submitted);

        // Contract only updates personalBest when score > previous best
        const updated = await getProfile(address);
        setProfile(updated);

        const newRecord = submitted > prevBest;
        setIsNewRecord(newRecord);
        setFinalScore(submitted);

        // Refresh leaderboard then find player's rank
        await refreshLeaderboard();
        const lb  = await getLeaderboard();
        const idx = lb.findIndex(
          (e) => e.address?.toLowerCase() === address?.toLowerCase(),
        );
        setResultRank(idx >= 0 ? idx + 1 : null);
      } catch (err) {
        console.error('submitScore failed:', err);
        setFinalScore(submitted);
      } finally {
        setScreen(S.RESULT);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  // Pause-to-home: keep the physics world + timer alive so game can be continued
  const handleGoHome = useCallback(() => {
    pauseEngine();
    pauseTimer();
    setHasPausedGame(true);
    setScreen(S.HOME);
  }, [pauseEngine, pauseTimer]);

  // Continue a paused game: set the resuming flag, unblock the timer, switch screen.
  // resumeEngine() is intentionally NOT called here — Playing's mount-effect calls it
  // after the canvas element is in the DOM (avoids black screen from stale ctx).
  const handleContinueGame = useCallback(() => {
    isResumingRef.current = true;
    resumeTimer();
    setHasPausedGame(false);
    setScreen(S.PLAYING);
  }, [resumeTimer]);

  const handleStartGame = useCallback(async () => {
    // Discard any paused game and start fresh
    setHasPausedGame(false);
    isResumingRef.current = false;
    setSessionStatus('pending');
    setScreen(S.PLAYING); // game starts immediately — tx fires concurrently
    try {
      await startGameTx();
      setSessionStatus('confirmed');
    } catch (err) {
      if (isUserRejection(err)) {
        stopEngine();
        stopTimer();
        setSessionStatus('idle');
        setScreen(S.HOME);
        return;
      }
      setSessionStatus('failed');
    }
  }, [startGameTx, stopEngine, stopTimer]);

  const handleSetUsername = useCallback(async (username) => {
    await setUsernameTx(username);
    const updated = await getProfile(address);
    setProfile(updated);
    setScreen(S.HOME);
  }, [setUsernameTx, getProfile, address]);

  const handlePurchase = useCallback(async (pkgIdx) => {
    try {
      const secs = await purchase(pkgIdx);
      showToast(`+${secs}s`);
      triggerTimeFX(`+${secs}s`);
    } catch (err) {
      if (isUserRejection(err)) return; // stay on game board
      showToast(err.message || 'Purchase failed');
    }
  }, [purchase, showToast, triggerTimeFX]);

  const handleUseBomb = useCallback(() => {
    const consumed = consumeBomb();
    if (!consumed) return;
    const removed = activateBomb();
    if (removed) showToast('Detonated! +200');
  }, [consumeBomb, activateBomb, showToast]);

  const handleUseExpand = useCallback(() => {
    const consumed = consumeExpand();
    if (!consumed) return;
    expandContainer();
    showToast('Vacuum widened!');
  }, [consumeExpand, expandContainer, showToast]);

  const handlePurchasePowerUp = useCallback(async (pkgIdx) => {
    try {
      const qty = await buyPowerUp(shop, pkgIdx);
      showToast(`+${qty} ${shop === 'bomb' ? 'bomb' : 'expand'}${qty > 1 ? 's' : ''} added`);
      setShop(null);
    } catch (err) {
      if (isUserRejection(err)) { setShop(null); return; } // stay on game board
      showToast(err.message || 'Purchase failed');
    }
  }, [buyPowerUp, shop, showToast]);

  // ── Screen routing ──────────────────────────────────────────────────────────

  // Low-gas modal overlays every post-connect screen.
  // Dismissed automatically the moment the balance poll detects sufficient CELO.
  const showGasModal = !!address && !hasGas && screen !== S.WALLET_CONNECT;

  let currentScreen;
  switch (screen) {
    case S.WALLET_CONNECT:
      currentScreen = (
        <WalletConnect
          onConnect={connect}
          onConnectSocial={connectWithSocial}
          socialLoading={socialLoading}
          isMiniPay={isMiniPay}
          error={walletError}
        />
      );
      break;

    case S.SET_USERNAME:
      currentScreen = (
        <SetUsername
          onSubmit={handleSetUsername}
          onSkip={() => setScreen(S.HOME)}
          checkUsernameAvailable={checkUsernameAvailable}
        />
      );
      break;

    case S.HOME:
      currentScreen = (
        <>
          <Home
            profile={profile}
            leaderboard={leaderboard}
            leaderboardLoading={leaderboardLoading}
            onStartGame={handleStartGame}
            hasPausedGame={hasPausedGame}
            pausedScore={score}
            pausedRemaining={remaining}
            onContinueGame={handleContinueGame}
            onOpenLegal={setLegalModal}
            onOpenFAQ={() => setShowFAQ(true)}
          />
          {showTutorial && (
            <HowToPlay onDone={() => {
              localStorage.setItem('nk_tutorial_seen', '1');
              setShowTutorial(false);
            }} />
          )}
          <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
          <FAQModal isOpen={showFAQ} onClose={() => setShowFAQ(false)} />
        </>
      );
      break;

    case S.STARTING:
      currentScreen = <Starting />;
      break;

    case S.PLAYING:
      currentScreen = (
        <Playing
          canvasRef={canvasRef}
          nextIdx={nextIdx}
          nextNextIdx={nextNextIdx}
          sessionStatus={sessionStatus}
          score={score}
          personalBest={profile?.personalBest ?? 0}
          remaining={remaining}
          containerWidth={containerWidth}
          packages={packages}
          onPurchase={handlePurchase}
          purchaseLoading={purchaseLoading}
          selectedToken={selectedToken}
          onSelectToken={setSelectedToken}
          balances={balances}
          totalBombs={totalBombs}
          totalExpands={totalExpands}
          onUseBomb={handleUseBomb}
          onUseExpand={handleUseExpand}
          onBuyBombs={() => setShop('bomb')}
          onBuyExpands={() => setShop('expand')}
          powerUpLoading={powerUpLoading}
          shop={shop}
          onCloseShop={() => setShop(null)}
          powerUpPackages={powerUpPackages}
          powerUpToken={powerUpToken}
          onSelectPowerUpToken={setPowerUpToken}
          onPurchasePowerUp={handlePurchasePowerUp}
          pauseTimer={pauseTimer}
          resumeTimer={resumeTimer}
          pauseEngine={pauseEngine}
          resumeEngine={resumeEngine}
          onGoHome={handleGoHome}
          muted={muted}
          onToggleMute={toggleMute}
          toast={toast}
          movePointer={movePointer}
          dropFruit={dropFruit}
          gameOver={gameOver}
        />
      );
      break;

    case S.SUBMITTING:
      currentScreen = <Submitting score={finalScore} />;
      break;

    case S.RESULT:
      currentScreen = (
        <Result
          score={finalScore}
          personalBest={profile?.personalBest ?? 0}
          isNewRecord={isNewRecord}
          rank={resultRank}
          leaderboard={leaderboard}
          leaderboardLoading={leaderboardLoading}
          onPlayAgain={() => setScreen(S.HOME)}
        />
      );
      break;

    default:
      currentScreen = null;
  }

  return (
    <>
      {currentScreen}
      {showGasModal && (
        <LowGasModal
          address={address}
          balanceDisplay={balanceDisplay}
          checking={gasChecking}
          onRecheck={recheckNow}
        />
      )}
      {/* Splash screen sits on top of everything, self-dismisses after ~3s */}
      {!splashDone && (
        <SplashScreen onDone={() => setSplashDone(true)} />
      )}
    </>
  );
}
