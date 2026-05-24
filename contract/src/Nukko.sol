// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Nukko is Initializable, OwnableUpgradeable, ReentrancyGuard, UUPSUpgradeable {

    // ─── Constants ────────────────────────────────────────────────────────────
    // Constants live in bytecode, not storage — no collision risk.

    uint256 public constant MAX_LEADERBOARD   = 50;
    uint256 public constant USERNAME_COOLDOWN = 7 days;
    uint8   public constant MAX_USERNAME_LEN  = 20;

    // ─── Data Structures ──────────────────────────────────────────────────────

    struct PlayerProfile {
        string  username;
        uint256 lastUsernameChange;
        uint256 personalBest;
        uint256 gamesPlayed;
        bool    sessionOpen;
    }

    struct LeaderboardEntry {
        address player;
        string  username;   // snapshot at submission time — renames don't alter history
        uint256 score;
        uint256 timestamp;
    }

    // ─── ERC-7201 Namespaced Storage ──────────────────────────────────────────
    //
    // All mutable state lives inside GameStorage, placed at a single
    // deterministic slot derived from "Nukko.storage.Game".
    //
    // Why this prevents collisions:
    //   • Sequential slots (0, 1, 2 …) are never used — our struct is at a
    //     keccak256-derived slot far outside that range.
    //   • Inherited contracts (OwnableUpgradeable, ReentrancyGuard, UUPS) each
    //     have their own ERC-7201 namespace — guaranteed non-overlapping.
    //   • The ERC-1967 proxy slots (implementation, admin) are also keccak256-
    //     derived and will never land on our slot.
    //   • Future upgrades: add new fields to GameStorage — no gap array needed,
    //     no slot arithmetic, no ordering constraints.
    //
    // Slot = keccak256(abi.encode(uint256(keccak256("Nukko.storage.Game")) - 1))
    //        & ~bytes32(uint256(0xff))

    // ─── NOTE: How to add state in future upgrades ────────────────────────────
    //
    // This contract uses ERC-7201 namespaced storage. All state lives inside
    // GameStorage at a single deterministic slot (GAME_STORAGE_LOCATION).
    //
    // DO:
    //   • Add new fields anywhere inside GameStorage below the existing ones.
    //   • Deploy new implementation and call upgradeToAndCall() from the owner.
    //   • All existing data is preserved — the proxy storage is untouched.
    //
    // DO NOT:
    //   • Remove existing fields from GameStorage — data at that slot is lost.
    //   • Reorder existing fields — every field after the change reads wrong data.
    //   • Add new top-level state variables outside GameStorage — they land on
    //     sequential slots (0, 1, 2 …) which are outside our ERC-7201 namespace
    //     and will collide with inherited contract storage.
    //   • Change the GAME_STORAGE_LOCATION constant — it is permanent.
    //
    // There is NO __gap array to manage. The ERC-7201 slot is the gap.
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:storage-location erc7201:Nukko.storage.Game
    struct GameStorage {
        mapping(address => PlayerProfile) profiles;
        mapping(string  => address)       usernameOwner;
        LeaderboardEntry[50]              leaderboard;
        uint256                           leaderboardCount;
        // ↓ Add new fields here for future upgrades. Never remove or reorder above.
    }

    bytes32 private constant GAME_STORAGE_LOCATION =
        0x9fc2dc13aec1be112262a90e8b87494d58214c13eaaf276723a79a14503e9000;

    function _gs() private pure returns (GameStorage storage $) {
        assembly {
            $.slot := GAME_STORAGE_LOCATION
        }
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    event UsernameSet(address indexed player, string username);
    event GameStarted(address indexed player, uint256 totalGamesPlayed);
    event ScoreSubmitted(address indexed player, uint256 score, bool newRecord);
    event LeaderboardUpdated(address indexed player, string username, uint256 score, uint256 rank);
    event LeaderboardEntryRemoved(address indexed player, address indexed removedBy);

    // ─── Constructor & Initializer ────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Called once through the proxy at deploy time — replaces the constructor.
    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
        // ReentrancyGuard and UUPSUpgradeable need no init — both use
        // ERC-7201 namespaced storage that is safe at default value 0.
    }

    // ─── UUPS upgrade authorization ───────────────────────────────────────────

    /// @dev Only the owner can point the proxy at a new implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ─── setUsername() ────────────────────────────────────────────────────────

    /// @notice Set or update your display name. 1–20 chars, a-z A-Z 0-9 _.
    ///         First-time: no cooldown. Rename: must wait USERNAME_COOLDOWN (7 days).
    ///         Uniqueness is enforced case-insensitively.
    function setUsername(string calldata _username) external {
        bytes memory b = bytes(_username);

        require(b.length >= 1,                "Nukko: username too short");
        require(b.length <= MAX_USERNAME_LEN, "Nukko: username too long");

        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            require(
                (c >= 0x30 && c <= 0x39) ||   // 0-9
                (c >= 0x41 && c <= 0x5A) ||   // A-Z
                (c >= 0x61 && c <= 0x7A) ||   // a-z
                (c == 0x5F),                   // _
                "Nukko: invalid character"
            );
        }

        GameStorage storage $ = _gs();
        PlayerProfile storage p = $.profiles[msg.sender];

        // Cooldown only applies to renames — not to first-time setup
        if (bytes(p.username).length > 0) {
            require(
                block.timestamp >= p.lastUsernameChange + USERNAME_COOLDOWN,
                "Nukko: wait 7 days before renaming"
            );
        }

        string memory lower        = _toLower(_username);
        address       currentOwner = $.usernameOwner[lower];
        require(
            currentOwner == address(0) || currentOwner == msg.sender,
            "Nukko: username already taken"
        );

        // Release old slot before claiming new one
        if (bytes(p.username).length > 0) {
            delete $.usernameOwner[_toLower(p.username)];
        }

        $.usernameOwner[lower]  = msg.sender;
        p.username              = _username;
        p.lastUsernameChange    = block.timestamp;

        emit UsernameSet(msg.sender, _username);
    }

    // ─── startGame() ──────────────────────────────────────────────────────────

    /// @notice Open a game session. Free and unlimited.
    ///         Calling this while a session is already open resets it —
    ///         handles mid-game app close gracefully.
    function startGame() external {
        PlayerProfile storage p = _gs().profiles[msg.sender];
        p.sessionOpen = true;
        p.gamesPlayed++;
        emit GameStarted(msg.sender, p.gamesPlayed);
    }

    // ─── submitScore() ────────────────────────────────────────────────────────

    /// @notice Submit final score. Requires an open session from startGame().
    ///         Leaderboard is only updated when the score is a new personal best.
    function submitScore(uint256 _score) external nonReentrant {
        PlayerProfile storage p = _gs().profiles[msg.sender];
        require(p.sessionOpen, "Nukko: no active session");

        p.sessionOpen = false;

        bool newRecord = _score > p.personalBest;
        if (newRecord) {
            p.personalBest = _score;
            _tryInsertLeaderboard(msg.sender, p.username, _score);
        }

        emit ScoreSubmitted(msg.sender, _score, newRecord);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Owner can remove a cheating or invalid entry from the leaderboard.
    function removeLeaderboardEntry(address _player) external onlyOwner {
        GameStorage storage $ = _gs();
        uint256 count = $.leaderboardCount;

        for (uint256 i = 0; i < count; i++) {
            if ($.leaderboard[i].player == _player) {
                for (uint256 j = i; j < count - 1; j++) {
                    $.leaderboard[j] = $.leaderboard[j + 1];
                }
                delete $.leaderboard[count - 1];
                $.leaderboardCount--;
                emit LeaderboardEntryRemoved(_player, msg.sender);
                return;
            }
        }
        revert("Nukko: player not on leaderboard");
    }

    // ─── Leaderboard (internal) ───────────────────────────────────────────────

    function _tryInsertLeaderboard(
        address _player,
        string memory _username,
        uint256 _score
    ) internal {
        GameStorage storage $ = _gs();

        string memory displayName = bytes(_username).length > 0
            ? _username
            : _shortAddress(_player);

        // ── Case A: player already has an entry — update and bubble up ──────
        for (uint256 i = 0; i < $.leaderboardCount; i++) {
            if ($.leaderboard[i].player == _player) {
                $.leaderboard[i].score     = _score;
                $.leaderboard[i].username  = displayName;
                $.leaderboard[i].timestamp = block.timestamp;

                uint256 bubblePos = i;
                while (
                    bubblePos > 0 &&
                    $.leaderboard[bubblePos].score > $.leaderboard[bubblePos - 1].score
                ) {
                    LeaderboardEntry memory tmp    = $.leaderboard[bubblePos];
                    $.leaderboard[bubblePos]       = $.leaderboard[bubblePos - 1];
                    $.leaderboard[bubblePos - 1]   = tmp;
                    bubblePos--;
                }

                emit LeaderboardUpdated(_player, _username, _score, bubblePos);
                return;
            }
        }

        // ── Case B: player not on board — try to insert ───────────────────
        uint256 insertAt = type(uint256).max;

        if ($.leaderboardCount < MAX_LEADERBOARD) {
            insertAt = $.leaderboardCount;
            $.leaderboardCount++;
        } else if (_score > $.leaderboard[MAX_LEADERBOARD - 1].score) {
            insertAt = MAX_LEADERBOARD - 1;
        }

        if (insertAt == type(uint256).max) return;

        uint256 pos = insertAt;
        while (pos > 0 && _score > $.leaderboard[pos - 1].score) {
            $.leaderboard[pos] = $.leaderboard[pos - 1];
            pos--;
        }

        $.leaderboard[pos] = LeaderboardEntry({
            player:    _player,
            username:  displayName,
            score:     _score,
            timestamp: block.timestamp
        });

        emit LeaderboardUpdated(_player, _username, _score, pos);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function leaderboardCount() external view returns (uint256) {
        return _gs().leaderboardCount;
    }

    function getLeaderboard() external view returns (LeaderboardEntry[] memory) {
        GameStorage storage $ = _gs();
        LeaderboardEntry[] memory board = new LeaderboardEntry[]($.leaderboardCount);
        for (uint256 i = 0; i < $.leaderboardCount; i++) {
            board[i] = $.leaderboard[i];
        }
        return board;
    }

    function getProfile(address _player)
        external view
        returns (
            string  memory username,
            uint256 personalBest,
            uint256 gamesPlayed,
            bool    sessionOpen
        )
    {
        PlayerProfile storage p = _gs().profiles[_player];
        return (p.username, p.personalBest, p.gamesPlayed, p.sessionOpen);
    }

    function isUsernameAvailable(string calldata _username)
        external view
        returns (bool)
    {
        address own = _gs().usernameOwner[_toLower(_username)];
        return own == address(0) || own == msg.sender;
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    function _toLower(string memory _str) internal pure returns (string memory) {
        bytes memory b     = bytes(_str);
        bytes memory lower = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            lower[i] = (b[i] >= 0x41 && b[i] <= 0x5A)
                ? bytes1(uint8(b[i]) + 32)
                : b[i];
        }
        return string(lower);
    }

    function _shortAddress(address _addr) internal pure returns (string memory) {
        bytes memory addr  = abi.encodePacked(_addr);
        bytes memory hex_c = "0123456789abcdef";
        bytes memory out   = new bytes(12);
        out[0] = '0'; out[1] = 'x';
        for (uint256 i = 0; i < 4; i++) {
            out[2 + i * 2]     = hex_c[uint8(addr[i]) >> 4];
            out[2 + i * 2 + 1] = hex_c[uint8(addr[i]) & 0x0f];
        }
        out[10] = '.'; out[11] = '.';
        return string(out);
    }
}
