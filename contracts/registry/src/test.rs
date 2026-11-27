use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env,
};

use crate::{
    types::{MAX_EXTEND, MAX_POLICIES_PER_OWNER, MIN_THRESHOLD},
    Registry, RegistryClient,
};

macro_rules! setup {
    () => {{
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let keeper = Address::generate(&env);
        let contract_id = env.register(Registry, ());
        let client = RegistryClient::new(&env, &contract_id);
        client.init(&admin);
        (env, client, admin, keeper)
    }};
}

macro_rules! setup_uninitialized {
    () => {{
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(Registry, ());
        let client = RegistryClient::new(&env, &contract_id);
        (env, client, admin)
    }};
}

fn pair(env: &Env) -> (Address, Address) {
    (Address::generate(env), Address::generate(env))
}

// --- init and admin -------------------------------------------------------

#[test]
fn init_sets_admin_and_zero_count() {
    let (_env, client, admin, _keeper) = setup!();
    assert_eq!(client.admin(), admin);
    assert_eq!(client.count(), 0);
}

#[test]
fn init_twice_fails() {
    let (_env, client, admin, _keeper) = setup!();
    assert!(client.try_init(&admin).is_err());
}

#[test]
fn admin_before_init_fails() {
    let (_env, client, _admin) = setup_uninitialized!();
    assert!(client.try_admin().is_err());
}

#[test]
fn init_without_auth_fails() {
    let (_env, client, admin) = setup_uninitialized!();
    assert!(client.try_init(&admin).is_err());
}

#[test]
fn keeper_unset_before_set_keeper() {
    let (_env, client, _admin, _keeper) = setup!();
    assert!(client.try_keeper().is_err());
}

#[test]
fn set_keeper_reads_back() {
    let (_env, client, _admin, keeper) = setup!();
    client.set_keeper(&keeper);
    assert_eq!(client.keeper(), keeper);
}

#[test]
fn set_keeper_without_auth_fails() {
    let (env, client, _admin, keeper) = setup!();
    env.mock_auths(&[]);
    assert!(client.try_set_keeper(&keeper).is_err());
}

#[test]
fn transfer_admin_replaces_authority() {
    let (env, client, _admin, _keeper) = setup!();
    let new_admin = Address::generate(&env);
    client.transfer_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);
}

// --- registration ---------------------------------------------------------

#[test]
fn register_assigns_sequential_ids() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    assert_eq!(client.register(&owner, &target, &1_000, &2_000_000), 0);
    assert_eq!(client.register(&owner, &target, &1_000, &2_000_000), 1);
    assert_eq!(client.count(), 2);
}

#[test]
fn register_stores_addresses_and_bounds() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    let id = client.register(&owner, &target, &1_000, &2_000_000);

    let policy = client.get(&id);
    assert_eq!(policy.id, id);
    assert_eq!(policy.owner, owner);
    assert_eq!(policy.target, target);
    assert_eq!(policy.threshold, 1_000);
    assert_eq!(policy.extend_to, 2_000_000);
    assert!(policy.active);
    assert_eq!(policy.last_reported, 0);
}

#[test]
fn register_rejects_threshold_below_minimum() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    assert!(client
        .try_register(&owner, &target, &(MIN_THRESHOLD - 1), &2_000_000)
        .is_err());
    assert_eq!(client.count(), 0);
}

#[test]
fn register_rejects_extend_at_or_below_threshold() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    assert!(client
        .try_register(&owner, &target, &1_000, &1_000)
        .is_err());
    assert!(client.try_register(&owner, &target, &1_000, &999).is_err());
}

#[test]
fn register_rejects_extend_above_protocol_cap() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    assert!(client
        .try_register(&owner, &target, &1_000, &(MAX_EXTEND + 1))
        .is_err());
}

#[test]
fn register_accepts_the_protocol_cap_exactly() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    assert!(client
        .try_register(&owner, &target, &1_000, &MAX_EXTEND)
        .is_ok());
}

#[test]
fn register_without_auth_fails() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    env.mock_auths(&[]);
    assert!(client
        .try_register(&owner, &target, &1_000, &2_000_000)
        .is_err());
}

#[test]
fn duplicate_targets_and_self_watch_allowed() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner_a, target) = pair(&env);
    let owner_b = Address::generate(&env);

    client.register(&owner_a, &target, &1_000, &2_000_000);
    client.register(&owner_b, &target, &1_000, &2_000_000);
    // A contract may watch itself.
    client.register(&target, &target, &1_000, &2_000_000);
    assert_eq!(client.count(), 3);
}

#[test]
fn per_owner_limit_is_enforced() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);

    let mut i = 0;
    while i < MAX_POLICIES_PER_OWNER {
        client.register(&owner, &target, &1_000, &2_000_000);
        i += 1;
    }

    assert!(client
        .try_register(&owner, &target, &1_000, &2_000_000)
        .is_err());
    assert_eq!(client.count(), MAX_POLICIES_PER_OWNER);
}

// --- reads ----------------------------------------------------------------

#[test]
fn get_missing_id_fails() {
    let (_env, client, _admin, _keeper) = setup!();
    assert!(client.try_get(&7).is_err());
}

#[test]
fn list_paginates_across_ids() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    for _ in 0..3 {
        client.register(&owner, &target, &1_000, &2_000_000);
    }

    assert_eq!(client.list(&0, &2).len(), 2);
    assert_eq!(client.list(&1, &2).len(), 1);
    assert_eq!(client.list(&2, &2).len(), 0);
}

#[test]
fn list_past_the_end_is_empty_not_an_error() {
    let (_env, client, _admin, _keeper) = setup!();
    assert_eq!(client.list(&0, &10).len(), 0);
    assert_eq!(client.list(&999, &10).len(), 0);
}

#[test]
fn list_clamps_limit() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    for _ in 0..3 {
        client.register(&owner, &target, &1_000, &2_000_000);
    }
    // limit 0 clamps up to 1, limit 10_000 clamps down to 50.
    assert_eq!(client.list(&0, &0).len(), 1);
    assert_eq!(client.list(&0, &10_000).len(), 3);
}

#[test]
fn list_by_owner_returns_only_theirs() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner_a, target) = pair(&env);
    let owner_b = Address::generate(&env);

    client.register(&owner_a, &target, &1_000, &2_000_000);
    client.register(&owner_b, &target, &1_000, &2_000_000);
    client.register(&owner_a, &target, &1_000, &2_000_000);

    let mine = client.list_by_owner(&owner_a);
    assert_eq!(mine.len(), 2);
    assert_eq!(mine.get(0).unwrap().id, 0);
    assert_eq!(mine.get(1).unwrap().id, 2);
}

// --- lifecycle ------------------------------------------------------------

#[test]
fn update_changes_bounds() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    let id = client.register(&owner, &target, &1_000, &2_000_000);

    client.update(&id, &5_000, &2_500_000);
    let policy = client.get(&id);
    assert_eq!(policy.threshold, 5_000);
    assert_eq!(policy.extend_to, 2_500_000);
}

#[test]
fn update_rejects_invalid_bounds() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    let id = client.register(&owner, &target, &1_000, &2_000_000);

    assert!(client.try_update(&id, &2_000_000, &1_000).is_err());
    assert!(client.try_update(&id, &10, &2_000_000).is_err());
}

#[test]
fn paused_policy_stays_queryable() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    let id = client.register(&owner, &target, &1_000, &2_000_000);

    client.pause(&id);
    assert!(!client.get(&id).active);

    client.resume(&id);
    assert!(client.get(&id).active);
}

#[test]
fn remove_deletes_and_never_reuses_the_id() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    let first = client.register(&owner, &target, &1_000, &2_000_000);

    client.remove(&first);
    assert!(client.try_get(&first).is_err());
    assert_eq!(client.count(), 1);

    // The next registration gets id 1, not the freed id 0.
    let second = client.register(&owner, &target, &1_000, &2_000_000);
    assert_eq!(second, 1);
    assert_eq!(client.list_by_owner(&owner).len(), 1);
}

#[test]
fn remove_missing_id_fails() {
    let (_env, client, _admin, _keeper) = setup!();
    assert!(client.try_remove(&42).is_err());
}

#[test]
fn remove_without_auth_fails() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    let id = client.register(&owner, &target, &1_000, &2_000_000);

    env.mock_auths(&[]);
    assert!(client.try_remove(&id).is_err());
    assert!(client.try_get(&id).is_ok());
}

// --- keeper reports -------------------------------------------------------

#[test]
fn report_records_extension() {
    let (env, client, _admin, keeper) = setup!();
    let (owner, target) = pair(&env);
    let id = client.register(&owner, &target, &1_000, &2_000_000);
    client.set_keeper(&keeper);

    env.ledger().with_mut(|li| {
        li.sequence_number = 500;
    });

    client.report(&id, &495);
    assert_eq!(client.get(&id).last_reported, 495);
}

#[test]
fn report_without_a_keeper_configured_fails() {
    let (env, client, _admin, _keeper) = setup!();
    let (owner, target) = pair(&env);
    let id = client.register(&owner, &target, &1_000, &2_000_000);
    assert!(client.try_report(&id, &1).is_err());
}

#[test]
fn report_from_the_future_fails() {
    let (env, client, _admin, keeper) = setup!();
    let (owner, target) = pair(&env);
    let id = client.register(&owner, &target, &1_000, &2_000_000);
    client.set_keeper(&keeper);

    env.ledger().with_mut(|li| {
        li.sequence_number = 100;
    });

    assert!(client.try_report(&id, &101).is_err());
}

#[test]
fn report_without_auth_fails() {
    let (env, client, _admin, keeper) = setup!();
    let (owner, target) = pair(&env);
    let id = client.register(&owner, &target, &1_000, &2_000_000);
    client.set_keeper(&keeper);

    env.mock_auths(&[]);
    assert!(client.try_report(&id, &1).is_err());
}
