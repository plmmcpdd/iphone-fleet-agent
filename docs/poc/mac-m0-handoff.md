# Mac Device Lab Handoff — M0+

Phase A validates only the Windows/WSL Control Plane and synthetic device paths. It does not validate a real iPhone.

## Required Mac preparation

- Clone this same repository; do not create a second long-lived source truth.
- Install a compatible Xcode and its command-line tools.
- Configure Apple signing for WebDriverAgent using an approved development team.
- Enable Developer Mode on the dedicated test iPhone and complete trusted pairing.
- Evaluate the current Mobile Next iOS stack, Mobile MCP and Mobilewright versions before installation; record exact versions and licenses in `docs/oss/`.
- Select every target using an explicit UDID and map it to the Fleet `deviceId`.
- Use dedicated non-production test accounts and approved test data only.
- Assign the approved test network profile and bind its identifier to `networkAssignmentId`.
- Configure a local Evidence path writable by the Mac worker.
- Require a human gate before any externally visible or irreversible action.

## M0 entry checks

1. Run the repo's Phase A verification and distinguish mock success from real-device status.
2. Confirm Xcode signing, pairing and WDA health without submitting a production write.
3. Prove one read-only health/screenshot action with explicit `deviceId`, UDID, Lease and fencing context.
4. Preserve screenshots, logs, action result and verification as digested Evidence.
5. Stop on account, device, network, policy, lease or fencing mismatch.

The first Mac Gate must document device model/iOS/Xcode/WDA/backend versions and test-account/network assumptions. Only that Gate may begin real-iOS validation.
