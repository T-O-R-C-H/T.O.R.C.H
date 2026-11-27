//! Registration and the read paths a keeper and a dashboard need.

use soroban_sdk::{Address, Env, Vec};

use crate::{
    events, storage,
    types::{
        Error, WatchPolicy, LIST_LIMIT_MAX, MAX_EXTEND, MAX_POLICIES_PER_OWNER, MIN_THRESHOLD,
    },
};

/// Shared by `register` and `update` so a policy can never enter a state the
/// keeper cannot act on.
pub fn validate(threshold: u32, extend_to: u32) -> Result<(), Error> {
    if threshold < MIN_THRESHOLD || extend_to <= threshold {
        return Err(Error::ThresholdOutOfRange);
    }
    if extend_to > MAX_EXTEND {
        return Err(Error::ExtendTooLarge);
    }
    Ok(())
}

pub fn register(
    env: &Env,
    owner: Address,
    target: Address,
    threshold: u32,
    extend_to: u32,
) -> Result<u32, Error> {
    owner.require_auth();
    validate(threshold, extend_to)?;

    let mut ids = storage::owner_index(env, &owner);
    if ids.len() >= MAX_POLICIES_PER_OWNER {
        return Err(Error::TooManyPolicies);
    }

    let id = storage::count(env);
    let policy = WatchPolicy {
        id,
        owner: owner.clone(),
        target: target.clone(),
        threshold,
        extend_to,
        active: true,
        registered_at: env.ledger().sequence(),
        last_reported: 0,
    };

    storage::put_policy(env, &policy);

    ids.push_back(id);
    storage::put_owner_index(env, &owner, &ids);

    // Ids are never reused, so `remove` must not touch this counter.
    let next = id.checked_add(1).ok_or(Error::TooManyPolicies)?;
    storage::set_count(env, next);

    events::registered(env, id, &owner, &target, threshold, extend_to);
    storage::bump_instance(env);
    Ok(id)
}

pub fn count(env: &Env) -> u32 {
    storage::count(env)
}

pub fn get(env: &Env, id: u32) -> Result<WatchPolicy, Error> {
    storage::get_policy(env, id)
}

/// `limit` is clamped to `1..=LIST_LIMIT_MAX`. Reading past the end returns an
/// empty vector rather than an error: a keeper polling a shrinking set is
/// normal, not exceptional.
pub fn list(env: &Env, page: u32, limit: u32) -> Vec<WatchPolicy> {
    let limit = limit.clamp(1, LIST_LIMIT_MAX);
    let total = storage::count(env);
    let mut out = Vec::new(env);

    let start = match page.checked_mul(limit) {
        Some(v) => v,
        None => return out,
    };
    if start >= total {
        return out;
    }

    let end = start.saturating_add(limit).min(total);
    let mut id = start;
    while id < end {
        if let Some(policy) = storage::find_policy(env, id) {
            out.push_back(policy);
        }
        id += 1;
    }
    out
}

pub fn list_by_owner(env: &Env, owner: Address) -> Vec<WatchPolicy> {
    let ids = storage::owner_index(env, &owner);
    let mut out = Vec::new(env);

    let mut i = 0;
    while i < ids.len() {
        if let Some(id) = ids.get(i) {
            if let Some(policy) = storage::find_policy(env, id) {
                out.push_back(policy);
            }
        }
        i += 1;
    }
    out
}
