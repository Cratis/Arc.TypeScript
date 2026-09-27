// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DialogResult, useDialogContext } from '@cratis/arc.react/dialogs';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm';
import { Guid } from '@cratis/fundamentals';
import { RegisterAuthor } from './RegisterAuthor.proxy';

export function RegisterAuthorForm() {
    const { closeDialog } = useDialogContext();
    return <CommandDialog<RegisterAuthor> command={RegisterAuthor} title="Register an author" okLabel="Register author"
        initialValues={{ id: Guid.create() }}
        onBeforeExecute={command => { command.name = command.name.trim(); return command; }}
        onSuccess={() => closeDialog(DialogResult.Ok)} onCancel={() => closeDialog(DialogResult.Cancelled)}>
        <InputTextField<RegisterAuthor> value={command => command.name} title="Name" placeholder="e.g. Octavia Butler" />
    </CommandDialog>;
}
