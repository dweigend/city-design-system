# View mode data

Kind: data

`viewModes` and `displayModes` define the serializable IDs for the shared stage.
A `ViewPolicy` declares a default pose and display for a step and the allowed IDs
for each. Each allowed list contains its default. Omit `displays` to allow only
the default display. Pass the policy to `resolveView` before applying a view.
