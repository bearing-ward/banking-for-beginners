---
title: MFA and getting back in
level: starter
summary: Add a second sign-in check, reject requests you did not start, and prepare a secure way back in before losing your phone.
---

A stolen password should not be enough to open your email or payment account. **Multifactor authentication**, or MFA, combines different kinds of proof, such as a password you know and a device you control. Two-factor authentication, or 2FA, is MFA using two kinds. Two passwords are still the same kind of proof.

Open your account's security settings yourself. Look for MFA, 2FA, or two-step verification. Start with email and accounts that hold money. Turn it on where offered, and prepare recovery before finishing setup.

## Choose the strongest method you can maintain

```table Common sign-in checks
| Method | What to know |
| Passkey or FIDO security key | Resists fake-site phishing; protect the device and arrange backup access |
| Authenticator app code | Avoids text-message interception, but a fake site can still steal a code you type |
| App approval prompt | Approve only a sign-in you started; use number matching if offered |
| Text or email code | Better than password-only when it is the only choice; protect the phone number or email too |
```

A **security key** is a physical device used to prove access to an account. An **authenticator app** can generate sign-in codes or show approval requests. The [FTC's two-factor guide](https://consumer.ftc.gov/articles/use-two-factor-authentication-protect-your-accounts) explains these options. Passkeys can combine device possession with a PIN or biometric check, so the site may not ask for another code.

## Never approve an unexpected request

Maya is doing homework, not signing in. These fictional messages appear one after another.

```message A login Maya did not start
Channel: text
From: +1 (202) 555-0124
This is account support. Approve the sign-in notification on your phone so we can stop a hacker.
! Maya did not start a sign-in
! A stranger wants her to approve access
! The claim of support does not verify the sender
```

Deny the request. Do not approve it to stop repeated notifications, and do not give the sender a code. Number matching does not make a stranger's request safe. [CISA's guidance on MFA prompts](https://www.cisa.gov/sites/default/files/publications/fact-sheet-implement-number-matching-in-mfa-applications-508c.pdf) warns that unexpected requests can signal a compromised password.

Open the real service independently. Review security activity, change a potentially exposed password, and use official support if anything is unfamiliar. For a school account, tell the school's technology staff. If you already approved access, use the service's account recovery guidance promptly, review recovery settings, and remove unfamiliar sessions or sign-in methods.

## Prepare for a lost phone

**Backup codes** are emergency sign-in secrets some services provide. They are often single-use. Follow that service's instructions, store them securely, and do not share them with someone claiming to help. [Login.gov's backup-code guide](https://www.login.gov/help/create-account/authentication-methods/backup-codes/) illustrates how one service handles them; other services differ.

Keep recovery codes separately from the phone you may lose. A printed copy in a locked place is one option. A screenshot only on that phone is not a usable backup if it disappears. Avoid keeping the only copy inside the account it unlocks.

```table Maya prepares before changing phones
| Check | Maya's action |
| Backup codes | Save securely away from the old phone and note where to find them |
| Recovery email and phone | Check they are current, under her control, and verified as the service requires |
| Another sign-in method | Register and confirm an offered backup method before removing the old one |
| Old device | Keep access until the new method works, then follow instructions to remove old access |
```

The [FTC's account recovery advice](https://consumer.ftc.gov/consumer-alerts/2024/10/email-or-social-media-hacked-heres-what-do) recommends checking recovery contact information. Protect a recovery email with its own unique password and MFA. Recheck settings when your number changes or you leave a school email account behind.

Today, check one account's recovery settings while you can still sign in. Confirm where its official recovery instructions live. Do not lock yourself out to test them.

```takeaways
- MFA adds another kind of proof; prefer phishing-resistant options when offered.
- Deny unexpected prompts, even if someone says approving will protect you.
- Store backup codes securely somewhere you can reach without the lost device.
- Keep recovery contacts current, verified, and under your control.
```

```quiz
? Maya gets an approval prompt while doing homework. A caller says to approve it to stop a hacker. What should she do?
- Approve once to stop the notifications
- Read the caller a verification code instead
+ Deny it and check the account through the real service independently
> A request Maya did not start could grant someone else access. The caller's story does not make it trustworthy.

? Where is a useful place for backup codes if your only phone disappears?
+ A secure place you can access without that phone or the locked account
- Only in a screenshot on that phone
- In a public note so they are easy to find
> Recovery must work without the thing you lost. Codes are secrets, so keep them protected as well as reachable.

? You are about to lose access to a school email used for recovery. What should you do first?
- Wait until the next sign-in fails
+ Update the recovery address and complete the service's verification while you still have access
- Turn off MFA on every account
> An old recovery address can block access or put recovery in someone else's hands. Keep the recovery route current.
```
