// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/Nukko.sol";

contract NukkoTest is Test {

    Nukko game; // points to the proxy — all calls go through it

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        // Deploy implementation
        Nukko implementation = new Nukko();

        // Deploy proxy — initialize with this test contract as owner
        bytes memory initData = abi.encodeWithSelector(
            Nukko.initialize.selector,
            address(this)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        // Cast proxy to Nukko interface — all calls hit the proxy
        game = Nukko(address(proxy));
    }

    // ─── Username ─────────────────────────────────────────────────────────────

    function test_setUsername_basic() public {
        vm.prank(alice);
        game.setUsername("Alice");
        (string memory name,,,) = game.getProfile(alice);
        assertEq(name, "Alice");
    }

    function test_setUsername_case_insensitive_unique() public {
        vm.prank(alice);
        game.setUsername("Alice");

        vm.prank(bob);
        vm.expectRevert("Nukko: username already taken");
        game.setUsername("alice");

        vm.prank(bob);
        vm.expectRevert("Nukko: username already taken");
        game.setUsername("ALICE");
    }

    function test_setUsername_same_player_can_reclaim_same_name_after_cooldown() public {
        vm.prank(alice);
        game.setUsername("Alice");
        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        game.setUsername("Alice");
        (string memory name,,,) = game.getProfile(alice);
        assertEq(name, "Alice");
    }

    function test_setUsername_rename_blocked_within_cooldown() public {
        vm.prank(alice);
        game.setUsername("Alice");

        vm.warp(block.timestamp + 6 days);
        vm.prank(alice);
        vm.expectRevert("Nukko: wait 7 days before renaming");
        game.setUsername("Alicia");
    }

    function test_setUsername_rename_allowed_after_cooldown() public {
        vm.prank(alice);
        game.setUsername("Alice");

        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        game.setUsername("Alicia");
        (string memory name,,,) = game.getProfile(alice);
        assertEq(name, "Alicia");
    }

    function test_setUsername_releases_old_slot_on_rename() public {
        vm.prank(alice);
        game.setUsername("Alice");

        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        game.setUsername("Alicia");

        vm.prank(bob);
        game.setUsername("Alice");
        (string memory name,,,) = game.getProfile(bob);
        assertEq(name, "Alice");
    }

    function test_setUsername_no_cooldown_on_first_set() public {
        vm.prank(alice);
        game.setUsername("Alice");
    }

    function test_setUsername_too_long() public {
        vm.prank(alice);
        vm.expectRevert("Nukko: username too long");
        game.setUsername("ThisNameIsWayTooLong123");
    }

    function test_setUsername_empty_reverts() public {
        vm.prank(alice);
        vm.expectRevert("Nukko: username too short");
        game.setUsername("");
    }

    function test_setUsername_invalid_chars_reverts() public {
        vm.prank(alice);
        vm.expectRevert("Nukko: invalid character");
        game.setUsername("bad name!");
    }

    function test_setUsername_max_length_accepted() public {
        vm.prank(alice);
        game.setUsername("twenty_chars_exactly");
    }

    function test_isUsernameAvailable() public {
        vm.prank(alice);
        game.setUsername("Alice");

        assertFalse(game.isUsernameAvailable("alice"));
        assertFalse(game.isUsernameAvailable("ALICE"));
        assertTrue(game.isUsernameAvailable("Bob"));
        assertTrue(game.isUsernameAvailable("alice_2"));
    }

    // ─── Session ──────────────────────────────────────────────────────────────

    function test_startGame_opens_session() public {
        vm.prank(alice);
        game.startGame();
        (,,, bool sessionOpen) = game.getProfile(alice);
        assertTrue(sessionOpen);
    }

    function test_startGame_increments_gamesPlayed_each_call() public {
        vm.prank(alice);
        game.startGame();
        vm.prank(alice);
        game.startGame();
        vm.prank(alice);
        game.startGame();
        (,, uint256 played,) = game.getProfile(alice);
        assertEq(played, 3);
    }

    function test_startGame_resets_already_open_session() public {
        vm.prank(alice);
        game.startGame();
        vm.prank(alice);
        game.startGame();
        (,,, bool sessionOpen) = game.getProfile(alice);
        assertTrue(sessionOpen);
    }

    function test_submitScore_requires_open_session() public {
        vm.prank(alice);
        vm.expectRevert("Nukko: no active session");
        game.submitScore(1000);
    }

    function test_submitScore_closes_session() public {
        vm.prank(alice);
        game.startGame();
        vm.prank(alice);
        game.submitScore(500);
        (,,, bool sessionOpen) = game.getProfile(alice);
        assertFalse(sessionOpen);
    }

    function test_submitScore_twice_reverts_on_second() public {
        vm.prank(alice);
        game.startGame();
        vm.prank(alice);
        game.submitScore(500);
        vm.prank(alice);
        vm.expectRevert("Nukko: no active session");
        game.submitScore(600);
    }

    function test_submitScore_zero_is_valid() public {
        vm.prank(alice);
        game.startGame();
        vm.prank(alice);
        game.submitScore(0);
        (, uint256 pb,,) = game.getProfile(alice);
        assertEq(pb, 0);
    }

    function test_submitScore_tracks_personal_best() public {
        _play(alice, 1000);
        (, uint256 pb,,) = game.getProfile(alice);
        assertEq(pb, 1000);

        _play(alice, 500);
        (, pb,,) = game.getProfile(alice);
        assertEq(pb, 1000);

        _play(alice, 2000);
        (, pb,,) = game.getProfile(alice);
        assertEq(pb, 2000);
    }

    // ─── Leaderboard — Sorted Insert ─────────────────────────────────────────

    function test_leaderboard_three_players_sorted() public {
        _play(alice, 500);
        _play(bob,   800);
        _play(carol, 650);

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        assertEq(board.length, 3);
        assertEq(board[0].score, 800);
        assertEq(board[1].score, 650);
        assertEq(board[2].score, 500);
    }

    function test_leaderboard_insert_at_top() public {
        _play(alice, 100);
        _play(bob,   200);
        _play(carol, 9999);

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        assertEq(board[0].score, 9999);
        assertEq(board[0].player, carol);
    }

    function test_leaderboard_insert_at_bottom() public {
        _play(alice, 1000);
        _play(bob,   900);
        _play(carol, 1);

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        assertEq(board[2].score, 1);
        assertEq(board[2].player, carol);
    }

    // ─── Leaderboard — One Entry Per Player ──────────────────────────────────

    function test_leaderboard_player_only_appears_once() public {
        _play(alice, 500);
        _play(alice, 1000);

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        assertEq(board.length, 1);
        assertEq(board[0].score, 1000);
        assertEq(board[0].player, alice);
    }

    function test_leaderboard_player_bubbles_up_on_new_pb() public {
        _play(alice, 300);
        _play(bob,   500);
        _play(carol, 700);

        _play(alice, 900);

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        assertEq(board[0].player, alice);
        assertEq(board[0].score, 900);
        assertEq(board.length, 3);
    }

    function test_leaderboard_non_pb_score_does_not_update_entry() public {
        _play(alice, 1000);
        _play(alice, 500);

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        assertEq(board[0].score, 1000);
        assertEq(board.length, 1);
    }

    function test_leaderboard_username_snapshot_preserved_after_rename() public {
        vm.prank(alice);
        game.setUsername("Alice");
        _play(alice, 5000);

        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        game.setUsername("Renamed");

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        assertEq(board[0].username, "Alice");
    }

    function test_leaderboard_new_pb_updates_username_snapshot() public {
        vm.prank(alice);
        game.setUsername("Alice");
        _play(alice, 5000);

        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        game.setUsername("AliceV2");

        _play(alice, 9999);

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        assertEq(board[0].username, "AliceV2");
    }

    function test_leaderboard_no_username_shows_short_address() public {
        _play(alice, 9999);

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        bytes memory name = bytes(board[0].username);
        assertEq(name[0], "0");
        assertEq(name[1], "x");
        assertEq(name[10], ".");
        assertEq(name[11], ".");
    }

    // ─── Leaderboard — Capacity (50) ─────────────────────────────────────────

    function test_leaderboard_fills_to_50() public {
        for (uint256 i = 0; i < 50; i++) {
            address player = makeAddr(string(abi.encodePacked("p", i)));
            _play(player, (i + 1) * 100);
        }
        assertEq(game.leaderboardCount(), 50);
    }

    function test_leaderboard_does_not_exceed_50() public {
        for (uint256 i = 0; i < 55; i++) {
            address player = makeAddr(string(abi.encodePacked("x", i)));
            _play(player, (i + 1) * 100);
        }
        assertEq(game.leaderboardCount(), 50);
    }

    function test_leaderboard_high_score_bumps_last_place() public {
        for (uint256 i = 0; i < 50; i++) {
            address player = makeAddr(string(abi.encodePacked("p", i)));
            _play(player, (i + 1) * 100);
        }

        Nukko.LeaderboardEntry[] memory before = game.getLeaderboard();
        assertEq(before[49].score, 100);

        _play(makeAddr("newPlayer"), 150);

        Nukko.LeaderboardEntry[] memory after_ = game.getLeaderboard();
        assertEq(after_.length, 50);
        assertEq(after_[49].score, 150);
    }

    function test_leaderboard_low_score_not_inserted_when_full() public {
        for (uint256 i = 10; i > 0; i--) {
            address player = makeAddr(string(abi.encodePacked("q", i)));
            _play(player, i * 1000);
        }
        for (uint256 i = 0; i < 40; i++) {
            address player = makeAddr(string(abi.encodePacked("r", i)));
            _play(player, 500 + i);
        }

        assertEq(game.leaderboardCount(), 50);

        Nukko.LeaderboardEntry[] memory snap = game.getLeaderboard();
        uint256 lowestOnBoard = snap[49].score;

        address loser = makeAddr("loser");
        _play(loser, lowestOnBoard - 1);

        Nukko.LeaderboardEntry[] memory after_ = game.getLeaderboard();
        assertEq(after_[49].score, lowestOnBoard);
    }

    // ─── Admin — removeLeaderboardEntry ──────────────────────────────────────

    function test_owner_can_remove_entry() public {
        _play(alice, 9999);
        assertEq(game.leaderboardCount(), 1);

        game.removeLeaderboardEntry(alice);
        assertEq(game.leaderboardCount(), 0);
    }

    function test_remove_entry_shifts_others_up() public {
        _play(alice, 3000);
        _play(bob,   2000);
        _play(carol, 1000);

        game.removeLeaderboardEntry(bob);

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        assertEq(board.length, 2);
        assertEq(board[0].score, 3000);
        assertEq(board[1].score, 1000);
    }

    function test_remove_nonexistent_entry_reverts() public {
        vm.expectRevert("Nukko: player not on leaderboard");
        game.removeLeaderboardEntry(alice);
    }

    function test_non_owner_cannot_remove_entry() public {
        _play(alice, 9999);
        vm.prank(bob);
        vm.expectRevert();
        game.removeLeaderboardEntry(alice);
    }

    // ─── Upgrade ──────────────────────────────────────────────────────────────

    function test_upgrade_preserves_state() public {
        // Set up state before upgrade
        vm.prank(alice);
        game.setUsername("Alice");
        _play(alice, 5000);
        _play(bob,   3000);

        // Deploy new implementation and upgrade
        Nukko newImpl = new Nukko();
        game.upgradeToAndCall(address(newImpl), "");

        // All state must survive the upgrade
        (string memory name, uint256 pb, uint256 played,) = game.getProfile(alice);
        assertEq(name,   "Alice");
        assertEq(pb,     5000);
        assertEq(played, 1);

        Nukko.LeaderboardEntry[] memory board = game.getLeaderboard();
        assertEq(board.length, 2);
        assertEq(board[0].score, 5000);
        assertEq(board[1].score, 3000);
    }

    function test_non_owner_cannot_upgrade() public {
        Nukko newImpl = new Nukko();
        vm.prank(alice);
        vm.expectRevert();
        game.upgradeToAndCall(address(newImpl), "");
    }

    function test_implementation_cannot_be_initialized_directly() public {
        // The implementation is locked by _disableInitializers() in the constructor
        Nukko implementation = new Nukko();
        vm.expectRevert();
        implementation.initialize(address(this));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _play(address player, uint256 score) internal {
        vm.prank(player);
        game.startGame();
        vm.prank(player);
        game.submitScore(score);
    }
}
