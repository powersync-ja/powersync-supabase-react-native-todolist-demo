# PowerSync + Supabase React Native Demo: Todo List 

## Note: Alpha Release

This package is currently in an alpha release. Functionality could change dramatically in future releases. Certain functions may be partially implemented or buggy.

## Overview

Demo app demonstrating use of the [PowerSync SDK for React Native](https://www.npmjs.com/package/@journeyapps/powersync-sdk-react-native) together with Supabase.

A step-by-step guide on Supabase<>PowerSync integration is available [here](https://docs.powersync.co/integration-guides/supabase). (Note: This guide is currently written for Flutter apps; it will be updated for React Native soon)

![powersync_supabase_react_native](https://github.com/de1mat/powersync-supabase-react-native-todolist-demo/assets/901045/02517426-85d2-4ac8-8ea5-f8e21f14e553)

## Running the App

Install the React Native SDK, then:

```sh
yarn install
```

Run on iOS

```sh
yarn ios
```

Run on Android

```sh
yarn android
```

## Setup Supabase Project

Create a new Supabase project, and paste an run the contents of [database.sql](./database.sql) in the Supabase SQL editor.

It does the following:

1. Create `lists` and `todos` tables.
2. Create a publication called `powersync` for `lists` and `todos`.
3. Enable row level security, allowing users to only view and edit their own data.
4. Create a trigger to populate some sample data when an user registers.

## Setup PowerSync Instance

Create a new PowerSync instance, connecting to the database of the Supabase project.

Then deploy the following sync rules:

```yaml
bucket_definitions:
  user_lists:
    # Separate bucket per todo list
    parameters: select id as list_id from lists where owner_id = token_parameters.user_id
    data:
      - select * from lists where id = bucket.list_id
      - select * from todos where list_id = bucket.list_id
```

## Configure The App

Copy the `AppConfig.template.ts` to a usable file

```bash
cp library/supabase/AppConfig.template.ts library/supabase/AppConfig.ts
```

Insert the necessary credentials.
