//! Shared types, constants and the contract error set.
//!
//! Constants are `const` rather than admin-settable on purpose: a keeper's
//! behaviour must not change because an operator changed a number in storage
//! that nobody reviewed.

use soroban_sdk::{contracterror, contracttype, Address};

/// Below this, a keeper cannot reliably act before archival.
pub const MIN_THRESHOLD: u32 = 100;

/// ~180 days of 5 second ledgers. Confirm the protocol's current `maxEntryTTL`
/// at deploy time and lower this if it has moved.
pub const MAX_EXTEND: u32 = 3_110_400;

/// Bounds the owner index read to one ledger entry's worth of work.
pub const MAX_POLICIES_PER_OWNER: u32 = 20;

/// Bounds a single `list` response.
pub const LIST_LIMIT_MAX: u32 = 50;

/// The registry extends its own entries on every write, so it cannot archive
/// while anybody is still using it.
pub const SELF_THRESHOLD: u32 = 518_400;
pub const SELF_EXTEND_TO: u32 = 3_110_400;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Keeper,
    Count,
    Policy(u32),
    OwnerIndex(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WatchPolicy {
    pub id: u32,
    /// Manages this policy. An account or a contract.
    pub owner: Address,
    /// Contract whose instance and code TTL are watched.
    pub target: Address,
    /// Act when remaining TTL is at or below this many ledgers.
    pub threshold: u32,
    /// Extend so remaining TTL is at least this many ledgers.
    pub extend_to: u32,
    pub active: bool,
    /// Ledger sequence at registration.
    pub registered_at: u32,
    /// Ledger sequence of the last keeper report. 0 means never.
    pub last_reported: u32,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    PolicyNotFound = 4,
    ThresholdOutOfRange = 5,
    TargetOutOfRange = 6,
    ExtendTooLarge = 7,
    LimitOutOfRange = 8,
    TooManyPolicies = 9,
    ReportInFuture = 10,
}
