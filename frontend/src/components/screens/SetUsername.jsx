import { useState } from 'react';
import Spinner from '../ui/Spinner.jsx';
import { useUsername } from '../../hooks/useUsername.js';

export default function SetUsername({ onSubmit, onSkip, checkUsernameAvailable }) {
  const [value,      setValue]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { available, checking, check } = useUsername(checkUsernameAvailable);

  const handleChange = (e) => {
    setValue(e.target.value);
    check(e.target.value);
  };

  const handleSubmit = async () => {
    if (!value || available !== true) return;
    setSubmitting(true);
    try {
      await onSubmit(value);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = value.length > 0 && available === true && !submitting;

  return (
    <div className="screen set-username">
      <h2>Choose a Username</h2>
      <p className="hint">
        Shown on the leaderboard. 1–20 chars, letters/numbers/underscore.
      </p>

      <input
        className="username-input"
        type="text"
        maxLength={20}
        placeholder="e.g. WatermelonKing"
        value={value}
        onChange={handleChange}
        autoComplete="off"
        spellCheck={false}
      />

      <div className="availability-row">
        {checking && <span className="hint">Checking…</span>}
        {!checking && available === true  && <span className="available">✅ Available!</span>}
        {!checking && available === false && <span className="taken">❌ Already taken</span>}
      </div>

      {submitting ? (
        <Spinner text="Saving username on Celo…" />
      ) : (
        <div className="btn-row">
          <button className="primary-btn" onClick={handleSubmit} disabled={!canSubmit}>
            Set Username
          </button>
          <button className="ghost-btn" onClick={onSkip}>
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}
