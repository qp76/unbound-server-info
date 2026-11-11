# Server Info for Unbound

A native Unbound plugin port of the Revenge **ServerInfo** plugin.

## Current status

**Project scaffold created — feature port not complete yet.**

The first commit establishes the Unbound manifest, package/build configuration and named lifecycle entry point. It intentionally does not patch Discord's guild menu yet. The menu module, menu-item shape and ActionSheet integration must be verified against the Discord/Unbound build installed on the target phone before enabling that hook.

## Planned features

- Server name, icon, banner and description
- Member and online counts
- Role and channel counts
- Boost level and boost count
- Server owner details and profile access
- Server creation date and server ID
- Friends who are members of the server

## Development

This project uses Unbound's official plugin SDK and CLI.

```sh
bun install
bun run build
```

For live development, use the official Unbound debugger workflow described in the developer documentation. The standard bridge is normally run on a computer; a cloud Codespaces setup still needs to be validated before it can be used reliably with an Android phone.

## Important

Do not install this scaffold expecting the Server Info menu item to appear yet. The next milestone is to connect the Android client to the development environment, inspect the guild-menu and ActionSheet APIs on that exact build, then implement and test the feature.

## Official documentation

- [Developer overview](https://unbound.rip/docs/developer/overview)
- [Your first plugin](https://unbound.rip/docs/developer/getting-started/first-plugin)
- [Plugin lifecycle](https://unbound.rip/docs/developer/getting-started/lifecycle)
- [Finding modules](https://unbound.rip/docs/developer/plugins/metro)
- [Patching components](https://unbound.rip/docs/developer/plugins/react-patching)
- [SDK reference](https://unbound.rip/docs/sdk/v1.0.0)
