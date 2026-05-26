import { useState, useCallback, useEffect, useRef } from 'react';

import { useWallet }      from './hooks/useWallet.js';
import { useContract }    from './hooks/useContract.js';
import { useTimer }       from './hooks/useTimer.js';
import { useGame }        from './hooks/useGame.js';
import { useLeaderboard } from './hooks/useLeaderboard.js';
import { usePurchase }    from './hooks/usePurchase.js';
import { usePowerUps }   from './hooks/usePowerUps.js';
import { isUserRejection } from './utils/miniPay.js';
import { useToast }       from './components/ui/Toast.jsx';
import { useAudio }       from './hooks/useAudio.js';

import WalletConnect from './components/screens/WalletConnect.jsx';
import SetUsername   from './components/screens/SetUsername.jsx';
import Home          from './components/screens/Home.jsx';
import Starting      from './components/screens/Starting.jsx';
import Playing       from './components/screens/Playing.jsx';
import Submitting    from './components/screens/Submitting.jsx';
import Result        from './components/screens/Result.jsx';

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
  const [screen,      setScreen]      = useState(S.WALLET_CONNECT);
  const [profile,     setProfile]     = useState(null);
  const [score,       setScore]       = useState(0);
  const [finalScore,  setFinalScore]  = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [resultRank,  setResultRank]  = useState(null);
  const [shop,          setShop]          = useState(null); // 'bomb' | 'expand' | null
  const [sessionStatus, setSessionStatus] = useState('idle'); // 'idle'|'pending'|'confirmed'|'failed'

  // Refs prevent stale closures in timer/game callbacks
  const screenRef  = useRef(screen);
  const scoreRef   = useRef(0);
  const profileRef = useRef(null);
  useEffect(() => { screenRef.current  = screen;  }, [screen]);
  useEffect(() => { scoreRef.current   = score;   }, [score]);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // ── Hooks ──────────────────────────────────────────────────────────────────

  const { address, walletClient, isMiniPay, connect, error: walletError } = useWallet();

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

  // ── Physics game-over → SUBMITTING ─────────────────────────────────────────

  useEffect(() => {
    if (!gameOver || screenRef.current !== S.PLAYING) return;
    stopTimer();
    setFinalScore(scoreRef.current);
    setScreen(S.SUBMITTING);
  }, [gameOver, stopTimer]);

  // ── Engine starts the moment the PLAYING screen mounts ────────────────────

  useEffect(() => {
    if (screen !== S.PLAYING) return;
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

  const handleStartGame = useCallback(async () => {
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

  switch (screen) {
    case S.WALLET_CONNECT:
      return (
        <WalletConnect
          onConnect={connect}
          isMiniPay={isMiniPay}
          error={walletError}
        />
      );

    case S.SET_USERNAME:
      return (
        <SetUsername
          onSubmit={handleSetUsername}
          onSkip={() => setScreen(S.HOME)}
          checkUsernameAvailable={checkUsernameAvailable}
        />
      );

    case S.HOME:
      return (
        <Home
          profile={profile}
          leaderboard={leaderboard}
          leaderboardLoading={leaderboardLoading}
          onStartGame={handleStartGame}
        />
      );

    case S.STARTING:
      return <Starting />;

    case S.PLAYING:
      return (
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
          toast={toast}
          movePointer={movePointer}
          dropFruit={dropFruit}
          gameOver={gameOver}
        />
      );

    case S.SUBMITTING:
      return <Submitting score={finalScore} />;

    case S.RESULT:
      return (
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

    default:
      return null;
  }
}
