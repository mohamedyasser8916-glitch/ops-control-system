# Microsoft OneDrive / Graph Integration (Future Automatic Sync)

**Status: not required for Phase 1.** Today, Data Management works with
manual file upload (.xlsx / .csv) — fully functional on its own. This
document explains what automatic OneDrive/SharePoint sync would need,
written so it can be handed to a Microsoft 365 administrator when the time
comes.

## What this would add

Instead of manually downloading and uploading the workbook, the app would
read the files directly from wherever they already live in OneDrive/
SharePoint, on a schedule.

## What it requires (do this only when ready to enable it)

**THIS STEP REQUIRES YOUR COMPANY IT / MICROSOFT 365 ADMIN**

An Azure App Registration with **Microsoft Graph** API permissions. Send
your IT/Microsoft 365 administrator the following request:

> Subject: App registration for Operations Control System — OneDrive read access
>
> We need an Azure AD App Registration to allow our internal Operations
> Control System to read specific files from OneDrive/SharePoint on a
> schedule (no user sign-in involved — this is a background/service
> connection).
>
> Please create an App Registration with:
> - **API permissions (Microsoft Graph, Application permissions — not
>   Delegated)**: `Files.Read.All` (or, if you prefer to scope it to one
>   site/library rather than the whole tenant, `Sites.Selected` with
>   access granted only to the specific SharePoint site/OneDrive folder
>   that holds the Operations Control System source files)
> - **Admin consent**: required for application permissions — please grant
>   admin consent after creating the registration.
> - A **client secret** (or certificate, if your policy prefers it) for
>   the app to authenticate with.
>
> Please send us:
> 1. **Application (client) ID**
> 2. **Directory (tenant) ID**
> 3. **Client secret value** (send this through a secure channel — password
>    manager or encrypted message, never plain email/chat)
> 4. Confirmation of which SharePoint site / OneDrive folder was granted
>    access (if using `Sites.Selected`)

## Where the values go

Once you have these four values, put them in the application's `.env` file
(never in chat, never in a spreadsheet, never committed to source control):

```
MS_GRAPH_CLIENT_ID="..."
MS_GRAPH_CLIENT_SECRET="..."
MS_GRAPH_TENANT_ID="..."
MS_GRAPH_DRIVE_ID="..."   # the specific drive/folder ID once identified via Graph Explorer
```

## Cost

Azure AD App Registrations and Microsoft Graph API calls at this scale are
**free** — they're included with any Microsoft 365 / Azure AD tenant. There
is no additional Microsoft cost for this integration.

## Implementation status

The import pipeline (`src/lib/importers/engine.ts`) already accepts a raw
file buffer regardless of where it came from — a Graph-based sync job would
just need to (1) authenticate with the client credentials above, (2)
download the target file's bytes via the Graph API, and (3) call the same
`runImport()` function manual upload uses today. No dashboard or database
change is required to add this later.
