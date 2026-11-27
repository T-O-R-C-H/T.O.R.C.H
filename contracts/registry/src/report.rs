//! The keeper reports what it did. This is not a payment claim — a contract
//! cannot read another contract's TTL, so nothing here can be verified on-chain
//! beyond "the configured keeper said so at this ledger".

use soroban_sdk::Env;

use crate::{events, storage, types::Error};

pub fn report(env: &Env, id: u32, extended_at: u32) -> Result<(), Error> {
    let keeper = storage::require_keeper(env)?;
    keeper.require_auth();

    if extended_at > env.ledger().sequence() {
        return Err(Error::ReportInFuture);
    }

    let mut policy = storage::get_policy(env, id)?;
    policy.last_reported = extended_at;
    storage::put_policy(env, &policy);

    events::extended(env, id, extended_at);
    storage::bump_instance(env);
    Ok(())
}
