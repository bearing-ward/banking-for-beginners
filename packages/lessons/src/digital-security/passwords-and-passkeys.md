---
title: Passwords and passkeys
level: starter
summary: Give each account its own login secret, protect your password manager, and plan where your passkeys will be available.
---

Your email can reset the password for your shopping account, payment app, or college portal. Protecting it helps protect the accounts connected to it.

A **password manager** generates and stores passwords so you do not have to memorize each one. Use it to make a long, random, unique password for every account that needs one. Follow the site's length rules; CISA recommends at least 16 characters. See [CISA's password tip sheet](https://www.cisa.gov/sites/default/files/2024-09/Secure-Our-World-Passwords-Tip-Sheet.pdf).

## One leak should not unlock every account

In this fictional example, Ari reused a shopping password for email. A shopping-site leak exposes that password. An attacker can now try it on Ari's email, too. Adding a number to the end of the same password is still a predictable pattern.

```table Ari changes the plan
| Account | Before | After |
| Email | Same password as shopping | Its own manager-generated password |
| Shopping | Same password as email | A different manager-generated password |
| College portal | A small variation | Another independently generated password |
```

If a service tells you a password was exposed, open its real app or website yourself and change it. Replace that password anywhere else you reused it. Do not follow a password-reset link from an unexpected message.

## Protect the manager's main lock

The manager's main login protects many accounts. Give it a long, unique master password or passphrase if it uses one, and turn on multifactor authentication where offered. A **passphrase** is a password made from several words; use unrelated words, not a quote or facts friends know about you. Do not reuse it elsewhere.

Read the manager's recovery instructions before relying on it. Keep any recovery material securely somewhere you can reach if the manager is locked. [NIST's password guidance](https://www.nist.gov/cybersecurity-and-privacy/how-do-i-create-good-password) explains why the manager's own login needs protection.

```table Ari's setup check
| Check | Action |
| Main login | Create a unique master passphrase and enable offered MFA |
| Everyday use | Turn on automatic locking and lock the device when away |
| Recovery | Follow the provider's recovery setup and store it securely |
| Shared computer | Do not save the vault there; sign out when finished |
```

## Passkeys change how you sign in

A **passkey** uses a digital key stored by your device or credential manager instead of a password you type into the site. You typically unlock its use with your device PIN, fingerprint, or face.

Passkeys resist **phishing**, attempts to trick you into giving away access. They are tied to the real service, so a lookalike website cannot collect a reusable password through a passkey sign-in. This does not make every message safe or protect every possible recovery route. Keep devices locked and updated, and check what you are authorizing.

Availability depends on where the passkey lives. **Synced** passkeys can become available on compatible devices through a protected account. **Device-bound** passkeys stay on a particular device or security key. A new phone does not automatically have either kind ready. [NIST's guide to syncable authenticators](https://pages.nist.gov/800-63-4/sp800-63b/syncable/) explains these differences.

```table Before Ari replaces a phone
| Setup | What Ari checks first |
| Synced passkey | Which provider stores it, whether sync is on, and access on another compatible device |
| Device-bound passkey | Whether a separate registered passkey or recovery method works |
| Either kind | Keep the old device until the new sign-in method is confirmed |
```

Choose one important account today. Open its security settings directly, replace any reused password, and check whether it offers a passkey and a recovery method you can maintain.

```takeaways
- Generate a different long, random password for every account that requires one.
- Protect the password manager's main login and prepare its recovery method.
- Passkeys resist phishing, but device security and account recovery still matter.
- Check where a passkey is stored before replacing or wiping a device.
```

```quiz
? Ari used the same leaked shopping password for email. What should Ari do?
- Change only the shopping password
+ Replace the exposed password on both accounts with different generated passwords
- Add the same extra digit on both accounts
> A leaked password can be tried elsewhere. Independent passwords keep the replacement from repeating that risk.

? What should Ari do before wiping the only phone holding a device-bound passkey?
+ Confirm another registered sign-in or recovery method works
- Assume every passkey automatically follows a new phone
- Send a copy of the device PIN to a friend
> A device-bound passkey stays with that device. Confirm another way in before removing it.

? A site supports a passkey. Does that make every message about the account safe?
- Yes, a passkey stops every scam
- Yes, recovery links no longer matter
+ No, check the service, the request, and recovery security
> Passkeys protect the sign-in exchange from phishing. They do not promise that every account action or message is safe.
```
