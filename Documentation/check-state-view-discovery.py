#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Exercise proxy generation, Node discovery and Chronicle registration on the published vertical-slice tabs.

The State View fences are checked for proxies, discovery and the compiled projection schema.
The State Change, Automation and Translation fences are checked for proxies and discovery of
every exported artifact, and their commands and reactors are run in process: registration
through the in-memory Chronicle command scenario, the expiry command against seeded
reservation history, and each reactor's returned commands through Arc's reactor result
handler. Nothing here needs a Chronicle kernel, so constraints are only checked for discovery.

The Real-Time Chat backends are built into an Arc application from discovery and run in process,
each shown file compiled as its own module, so an import cycle between them fails here as it
fails the application:
a subscriber to the room's query receives each message the command sends, the delta transfer sends
only the new message, and the RabbitMQ variant's room loads its history and receives from a
stand-in broker.
"""

import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("client_snippets", Path(__file__).with_name("validate-client-snippets.py"))
validator = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = validator
spec.loader.exec_module(validator)

STATE_VIEW_IDS = (
    "scenarios/vertical-slices/state-view/author-list",
    "scenarios/vertical-slices/state-view/fluent-projection",
)

# The other vertical-slice pages. Every artifact they declare is exported, because Arc's Node
# discovery and proxy generation only see exported classes; the check below asserts that each
# one is found and exercises the commands and reactors in process.
SLICE_IDS = (
    "scenarios/vertical-slices/state-change/concepts",
    "scenarios/vertical-slices/state-change/registration",
    "scenarios/vertical-slices/state-change/unique-author-name",
    "scenarios/vertical-slices/state-change/register-author-spec",
    "scenarios/vertical-slices/automation/reservation-domain",
    "scenarios/vertical-slices/automation/expiry-management",
    "scenarios/vertical-slices/translator/member-concepts",
    "scenarios/vertical-slices/translator/member-registration",
    "scenarios/vertical-slices/translator/unique-member-name",
    "scenarios/vertical-slices/translator/hr-integration",
)

# The Real-Time Chat pages: each shows a whole chat backend.
CHAT_IDS = (
    "scenarios/chat/in-memory/backend",
    "scenarios/chat/rabbitmq/backend",
)

IDS = STATE_VIEW_IDS + SLICE_IDS + CHAT_IDS

# The script is run outside the discovered folder: NodeArcApplicationBuilder refuses to
# discover its own bootstrap. Both source analysis and runtime discovery use actual output
# from the published fences, not hand-maintained copies of their classes.
CHECK = """
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyzeSource } from '__ROOT__/Source/Tools/ProxyGenerator/dist/analyzeSource.js';
import { renderSource } from '__ROOT__/Source/Tools/ProxyGenerator/dist/renderSource.js';
import { NodeArcApplicationBuilder } from '__ROOT__/Source/Core/dist/NodeArcApplicationBuilder.js';
import { ChronicleArtifacts } from '__ROOT__/Source/Chronicle/dist/ChronicleArtifacts.js';
import { ObservableTransfer } from '__ROOT__/Source/Core/dist/queries/observable/ObservableTransfer.js';
import { ProjectionDefinitionCompiler } from '__ROOT__/node_modules/@cratis/chronicle/dist/projections/ProjectionDefinitionCompiler.js';

const root = process.cwd();
const cases = ['scenarios_vertical_slices_state_view_author_list', 'scenarios_vertical_slices_state_view_fluent_projection'];
const [list, fluent] = await Promise.all(cases.map(name => import(pathToFileURL(join(root, 'dist/snippets', name, 'snippet.js')).href)));
const [listName, fluentName] = cases;
const analysis = analyzeSource(join(root, 'tsconfig.json'), join(root, 'snippets', listName));
assert.ok(analysis.operations.some(operation => operation.name === 'allAuthors' && operation.owner === 'Author'), 'AllAuthors query missing from source analysis');
const proxies = renderSource(analysis);
assert.ok([...proxies.keys()].some(name => name.endsWith('AllAuthors.ts')), 'AllAuthors proxy missing');
assert.ok([...proxies.keys()].some(name => name.endsWith('Author.ts')), 'Author proxy missing');

for (const [name, module, expected] of [[listName, list, ['AuthorRegistered', 'Author']],
    [fluentName, fluent, ['AuthorImported', 'Author', 'AuthorProjection']]]) {
    for (const exported of expected) assert.equal(typeof module[exported], 'function', `${name}: ${exported} not exported`);
    const catalog = new ChronicleArtifacts();
    const builder = new NodeArcApplicationBuilder();
    builder.addArtifactObserver(type => catalog.register(type));
    await builder.discover(pathToFileURL(join(root, 'dist/snippets', name)));
    if (name === listName) {
        assert.ok(catalog.eventTypes.includes(module.AuthorRegistered), 'Node discovery missed AuthorRegistered');
        assert.ok(catalog.readModels.includes(module.Author), 'Node discovery missed Author');
    } else {
        assert.ok(catalog.eventTypes.includes(module.AuthorImported), 'Node discovery missed AuthorImported');
        assert.ok(catalog.projections.includes(module.AuthorProjection), 'Node discovery missed AuthorProjection');
        assert.ok(catalog.readModels.includes(module.Author), 'Node discovery missed projection read model');
        const compiled = new ProjectionDefinitionCompiler(catalog, 'test-sink').compile(catalog.projections, []);
        assert.equal(compiled.definitions.length, 1);
        assert.equal(compiled.definitions[0].ReadModel, 'Author');
        assert.equal(compiled.readModels.length, 1);
        assert.equal(compiled.readModels[0].Type.Identifier, 'Author');
        const schema = JSON.parse(compiled.readModels[0].Schema);
        for (const field of ['id', 'firstName', 'lastName'])
            assert.ok(schema.properties?.[field], `Compiled Author read model is missing ${field}: ${JSON.stringify(schema)}`);
    }
}
console.log('PASS State View source proxies, Node discovery and Author projection schema');

// Each snippet compiles in the folder its page's layout gives it (Context.location), beside
// copies of the page snippets it imports by relative path.
// A multi-file snippet (Context.files) is one module per shown file; its exports are merged,
// imported in the sorted order Arc's discovery loads them.
const folders = __FOLDERS__;
const fileStems = __MODULES__;
const load = (id, file) => import(pathToFileURL(join(root, 'dist/snippets', folders[id], file)).href);
const slice = async id => {
    const merged = {};
    for (const stem of fileStems[id]) Object.assign(merged, await load(id, `${stem}.js`));
    return merged;
};
const discovered = async id => {
    const catalog = new ChronicleArtifacts();
    const seen = new Set();
    const builder = new NodeArcApplicationBuilder();
    builder.addArtifactObserver(type => { seen.add(type); return catalog.register(type); });
    await builder.discover(pathToFileURL(join(root, 'dist/snippets', folders[id])));
    return { catalog, seen };
};
const proxiesFor = (id, expected) => {
    const proxies = [...renderSource(analyzeSource(join(root, 'tsconfig.json'), join(root, 'snippets', folders[id]))).keys()];
    for (const name of expected)
        assert.ok(proxies.some(proxy => proxy.endsWith(`${name}.ts`)), `${id}: ${name} proxy missing from ${proxies.join(', ')}`);
};
const expectDiscovered = (id, { catalog, seen }, module, kinds) => {
    for (const [kind, names] of Object.entries(kinds))
        for (const name of names) {
            assert.equal(typeof module[name], 'function', `${id}: ${name} not exported`);
            const found = kind === 'arc' ? seen.has(module[name]) : catalog[kind].includes(module[name]);
            assert.ok(found, `${id}: Node discovery missed ${name} (${kind})`);
        }
};

const ids = {
    concepts: 'scenarios_vertical_slices_state_change_concepts',
    registration: 'scenarios_vertical_slices_state_change_registration',
    uniqueAuthor: 'scenarios_vertical_slices_state_change_unique_author_name',
    reservations: 'scenarios_vertical_slices_automation_reservation_domain',
    expiry: 'scenarios_vertical_slices_automation_expiry_management',
    memberConcepts: 'scenarios_vertical_slices_translator_member_concepts',
    memberRegistration: 'scenarios_vertical_slices_translator_member_registration',
    uniqueMember: 'scenarios_vertical_slices_translator_unique_member_name',
    hr: 'scenarios_vertical_slices_translator_hr_integration'
};
const modules = Object.fromEntries(await Promise.all(Object.entries(ids).map(async ([name, id]) => [name, await slice(id)])));
const expectations = {
    concepts: { arc: ['AuthorNameValidator'] },
    registration: { arc: ['RegisterAuthor', 'RegisterAuthorValidator'], eventTypes: ['AuthorRegistered'] },
    uniqueAuthor: { constraints: ['UniqueAuthorName'] },
    reservations: { eventTypes: ['BookReserved', 'ReservationCancelled', 'BookBorrowedFromReservation'] },
    expiry: { arc: ['CancelExpiredReservation'], eventTypes: ['ReservationExpired', 'DailyTick'],
        readModels: ['ReservationDueForExpiry', 'PendingReservation'], reactors: ['ReservationExpiryReactor'] },
    memberConcepts: { arc: ['MemberNameValidator'] },
    memberRegistration: { arc: ['RegisterMember'], eventTypes: ['MemberRegistered'] },
    uniqueMember: { constraints: ['UniqueMemberName'] },
    hr: { eventTypes: ['HRMemberCreated'], reactors: ['MemberImportReactor'] }
};
for (const [name, kinds] of Object.entries(expectations))
    expectDiscovered(ids[name], await discovered(ids[name]), modules[name], kinds);
proxiesFor(ids.registration, ['RegisterAuthor']);
proxiesFor(ids.expiry, ['CancelExpiredReservation']);
proxiesFor(ids.memberRegistration, ['RegisterMember']);
console.log('PASS vertical-slice source proxies and Node discovery of every exported artifact');

const { ChronicleCommandScenario } = await import('@cratis/arc.chronicle/testing');
const { reactorCommandResultHandler } = await import('@cratis/arc.chronicle');
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const context = source => ({ eventSourceId: source, sequenceNumber: 0n, eventType: { id: { value: 'event' } },
    correlationId: '00000000-0000-0000-0000-000000000001' });
// The concepts and neighbouring slices each snippet actually imports: the page snippets' own
// copies beside it, never the fixtures.
const { AuthorName } = await load(ids.registration, '../AuthorName.js');
const { ISBN } = await load(ids.expiry, '../ISBN.js');
const { MemberId } = await load(ids.expiry, '../../Members/MemberId.js');
const { ReservationId } = await load(ids.expiry, '../ReservationId.js');
const hrRegistration = await load(ids.hr, '../Registration/Registration.js');
const { MemberName: RegistrationMemberName } = await load(ids.memberRegistration, '../MemberName.js');

// State Change: the returned identity is both the response and the event source.
{
    const { RegisterAuthor, RegisterAuthorValidator, AuthorRegistered } = modules.registration;
    const scenario = ChronicleCommandScenario.for(RegisterAuthor, RegisterAuthorValidator, AuthorRegistered);
    try {
        const result = await scenario.execute({ firstName: new AuthorName('J.R.R.'), lastName: new AuthorName('Tolkien') });
        result.shouldBeSuccessful();
        assert.match(String(result.response), guid, `RegisterAuthor response is not an identity: ${result.response}`);
        assert.equal(result.appendedEvents.length, 1);
        result.shouldHaveAppendedEvent(AuthorRegistered, String(result.response),
            event => event.firstName.value === 'J.R.R.' && event.lastName.value === 'Tolkien');
        const rejected = await scenario.execute({ firstName: new AuthorName(''), lastName: new AuthorName('Tolkien') });
        rejected.shouldNotBeSuccessful().shouldHaveValidationErrorFor('First name is required');
        assert.equal(rejected.appendedEvents.length, 0);
    } finally { await scenario.dispose(); }
}

// Automation: the expiry decision, and the reactor's sweep. The in-memory scenario cannot
// evaluate a passive projection, so the decision reads pinned reservations.
{
    const { CancelExpiredReservation, PendingReservation, ReservationExpired, ReservationExpiryReactor } = modules.expiry;
    const member = MemberId.create();
    const expired = ReservationId.create().value.toString();
    const pending = ReservationId.create().value.toString();
    const reservation = (id, isbn, expiresAt) => Object.assign(new PendingReservation(),
        { id: new ReservationId(id), isbn: new ISBN(isbn), memberId: member, expiresAt });
    const scenario = ChronicleCommandScenario.for(CancelExpiredReservation, PendingReservation, ReservationExpired);
    try {
        scenario.givenReadModel(PendingReservation, expired, reservation(expired, '978-0', new Date(Date.now() - 60_000)));
        scenario.givenReadModel(PendingReservation, pending, reservation(pending, '978-1', new Date(Date.now() + 3_600_000)));
        const due = await scenario.execute(new CancelExpiredReservation(new ReservationId(expired)));
        due.shouldBeSuccessful();
        assert.equal(due.appendedEvents.length, 1);
        due.shouldHaveAppendedEvent(ReservationExpired, expired, event => event.isbn.value === '978-0');
        const early = await scenario.execute(new CancelExpiredReservation(new ReservationId(pending)));
        early.shouldBeSuccessful();
        assert.equal(early.appendedEvents.length, 0, 'CancelExpiredReservation appended for a reservation that is not yet due');
    } finally { await scenario.dispose(); }

    // The reactor's returned array goes through Arc's reactor result handler, which runs each
    // command through the Arc pipeline; the pinned reservation is still the one that is due.
    const reactor = new ReservationExpiryReactor();
    const now = new Date();
    const candidates = [{ id: new ReservationId(expired), expiresAt: new Date(now.getTime() - 1) },
        { id: new ReservationId(pending), expiresAt: new Date(now.getTime() + 60_000) }];
    const commands = await reactor.dailyTick(JSON.parse(JSON.stringify({ occurredAt: now })), context('scheduler'),
        { readModels: { getInstances: async type => { assert.equal(type.name, 'ReservationDueForExpiry'); return candidates; } } });
    assert.equal(commands.length, 1);
    assert.ok(commands[0] instanceof CancelExpiredReservation);
    assert.equal(commands[0].reservationId.value.toString(), expired);
    const sweep = ChronicleCommandScenario.for(CancelExpiredReservation, PendingReservation, ReservationExpired);
    const results = [];
    const server = { execute: async value => { const result = await sweep.execute(value); results.push(result); return result; } };
    try {
        sweep.givenReadModel(PendingReservation, expired, reservation(expired, '978-0', new Date(now.getTime() - 1)));
        assert.equal(await reactorCommandResultHandler(() => server)(commands, context('scheduler'), ReservationExpiryReactor, 'store', 'tenant'), true);
        assert.equal(results.length, 1);
        results[0].shouldBeSuccessful();
        results[0].shouldHaveAppendedEvent(ReservationExpired, expired, event => event.isbn.value === '978-0');
    } finally { await sweep.dispose(); }
}

// Translation: the reactor filters and translates, and Arc runs the returned command.
{
    const { MemberImportReactor } = modules.hr;
    const reactor = new MemberImportReactor();
    const payload = { employeeId: 'EMP-00247', givenName: 'Ada', familyName: 'Lovelace' };
    assert.equal(reactor.hRMemberCreated({ ...payload, status: 'INACTIVE' }), undefined);
    const command = reactor.hRMemberCreated({ ...payload, status: 'ACTIVE' });
    // The command the reactor returns is the page's RegisterMember, imported by the page's path.
    assert.ok(command instanceof hrRegistration.RegisterMember);
    const scenario = ChronicleCommandScenario.for(hrRegistration.RegisterMember, hrRegistration.MemberRegistered);
    const results = [];
    const server = { execute: async value => { const result = await scenario.execute(value); results.push(result); return result; } };
    try {
        assert.equal(await reactorCommandResultHandler(() => server)(command, context('EMP-00247'), MemberImportReactor, 'store', 'tenant'), true);
        assert.equal(results.length, 1);
        results[0].shouldBeSuccessful();
        results[0].shouldHaveAppendedEvent(hrRegistration.MemberRegistered, String(results[0].response),
            event => event.firstName.value === 'Ada' && event.lastName.value === 'Lovelace');
    } finally { await scenario.dispose(); }

    const { RegisterMember, MemberRegistered } = modules.memberRegistration;
    const registration = ChronicleCommandScenario.for(RegisterMember, MemberRegistered);
    try {
        const result = await registration.execute(new RegisterMember(new RegistrationMemberName('Grace'), new RegistrationMemberName('Hopper')));
        result.shouldBeSuccessful();
        assert.match(String(result.response), guid);
        result.shouldHaveAppendedEvent(MemberRegistered, String(result.response), event => event.firstName.value === 'Grace');
    } finally { await registration.dispose(); }
}
console.log('PASS vertical-slice commands and reactors run in process: registration, expiry and member import');

// Real-Time Chat: build each backend into an Arc application from discovery, subscribe to a room,
// send through the command and watch the subscription receive the message.
const { Guid } = await import('@cratis/fundamentals');
const { Severity } = await import('@cratis/arc.core');
const execution = () => ({ correlationId: Guid.create().toString(), principal: undefined, tenantId: undefined,
    signal: new AbortController().signal, allowedSeverity: Severity.Warning });
const chatApplication = async (id, register = () => {}) => {
    const builder = new NodeArcApplicationBuilder();
    register(builder);
    await builder.discover(pathToFileURL(join(root, 'dist/snippets', folders[id])));
    const app = await builder.build();
    const name = (operations, operation) => {
        const found = operations.filter(candidate => candidate.name === operation);
        assert.equal(found.length, 1, `${id}: ${operation} is not registered once: ${operations.map(item => item.name).join(', ')}`);
        return found[0].fullyQualifiedName;
    };
    return { app, send: name(app.server.commands, 'SendMessage'), forRoom: name(app.server.queries, 'forRoom') };
};
const next = async (results, label) => {
    const result = await Promise.race([results.next(), new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: no emission`)), 5000))]);
    assert.equal(result.done, false, `${label}: the subscription ended`);
    assert.ok(result.value.isSuccess, `${label}: ${JSON.stringify(result.value)}`);
    return result.value;
};
const sendMessage = async (chat, roomName, user, message) => {
    const sent = await chat.app.server.executeCommand(chat.send, { roomName, user, message }, execution());
    assert.ok(sent.isSuccess, `SendMessage failed: ${JSON.stringify(sent)}`);
};
const users = result => result.data.map(item => `${item.user}: ${item.message}`);

// In-memory: the room is a BehaviorSubject in a @singleton ChatService.
{
    const id = 'scenarios_chat_in_memory_backend';
    expectDiscovered(id, await discovered(id), await slice(id), { arc: ['ChatMessage', 'SendMessage'] });
    proxiesFor(id, ['ForRoom', 'SendMessage', 'ChatMessage']);
    const chat = await chatApplication(id);
    try {
        const session = await chat.app.server.openObservableQuery(chat.forRoom, { roomName: 'lobby' }, execution());
        assert.equal(session.rejection, undefined, `forRoom was rejected: ${JSON.stringify(session.rejection)}`);
        const results = session.results();
        const transfer = new ObservableTransfer('delta');
        const frame = result => { const prepared = transfer.prepare(result); prepared.commit(); return prepared.payload; };
        try {
            const initial = await next(results, 'initial history');
            assert.deepEqual(initial.data, []);
            assert.deepEqual(frame(initial).data, []);

            await sendMessage(chat, 'lobby', 'ada', 'hello');
            const first = await next(results, 'first message');
            assert.deepEqual(users(first), ['ada: hello']);
            const firstFrame = frame(first);
            assert.equal(firstFrame.data, undefined, 'a delta frame carried the whole history');
            assert.equal(firstFrame.changeSet.added.length, 1);
            assert.equal(typeof firstFrame.changeSet.added[0].id, 'string', 'ChatMessage.id is not a string on the wire');

            await sendMessage(chat, 'lobby', 'grace', 'hi');
            const second = await next(results, 'second message');
            assert.deepEqual(users(second), ['ada: hello', 'grace: hi']);
            const secondFrame = frame(second);
            assert.deepEqual(secondFrame.changeSet.added.map(item => item.user), ['grace'], 'the delta is not only the new message');
            assert.deepEqual(secondFrame.changeSet.removed, []);
            assert.deepEqual(secondFrame.changeSet.replaced, []);
        } finally { await results.return(undefined); await session.close(); }

        // A snapshot of the room answers from the current value, and rooms do not share messages.
        const snapshot = await chat.app.server.performQuery(chat.forRoom, { roomName: 'lobby' }, execution());
        assert.deepEqual(users(snapshot), ['ada: hello', 'grace: hi']);
        const other = await chat.app.server.performQuery(chat.forRoom, { roomName: 'kitchen' }, execution());
        assert.deepEqual(other.data, []);
    } finally { await chat.app.dispose(); }
}

// RabbitMQ: the room loads its history from ChatPersistence, SendMessage publishes through
// ChatPublisher, and a stand-in broker delivers the envelope back to the room.
{
    const id = 'scenarios_chat_rabbitmq_backend';
    const module = await slice(id);
    expectDiscovered(id, await discovered(id), module, { arc: ['ChatMessage', 'SendMessage'] });
    proxiesFor(id, ['ForRoom', 'SendMessage', 'ChatMessage']);
    const { ChatPersistence, ChatPublisher, ChatService, ChatMessage, ChatMessageId } = module;
    const stored = new ChatMessage(ChatMessageId.create(), 'system', new Date(0), 'welcome');
    const published = [];
    class StoredHistory extends ChatPersistence {
        async history(roomName) { return roomName === 'lobby' ? [stored] : []; }
    }
    class LoopbackBroker extends ChatPublisher {
        static inject = [ChatService];
        constructor(chatService) { super(); this.chatService = chatService; }
        async publish(envelope) {
            published.push(envelope);
            const room = await this.chatService.getChatRoom(envelope.roomName);
            room.receive(new ChatMessage(new ChatMessageId(Guid.parse(envelope.id)), envelope.user, new Date(envelope.sentAt), envelope.message));
        }
    }
    const chat = await chatApplication(id, builder => {
        builder.services.addSingleton(ChatPersistence, StoredHistory);
        builder.services.addSingleton(ChatPublisher, LoopbackBroker);
    });
    try {
        const session = await chat.app.server.openObservableQuery(chat.forRoom, { roomName: 'lobby' }, execution());
        assert.equal(session.rejection, undefined, `forRoom was rejected: ${JSON.stringify(session.rejection)}`);
        const results = session.results();
        try {
            assert.deepEqual(users(await next(results, 'persisted history')), ['system: welcome']);
            await sendMessage(chat, 'lobby', 'ada', 'hello');
            assert.equal(published.length, 1);
            assert.equal(published[0].roomName, 'lobby');
            assert.deepEqual(users(await next(results, 'received message')), ['system: welcome', 'ada: hello']);
        } finally { await results.return(undefined); await session.close(); }
    } finally { await chat.app.dispose(); }
}
console.log('PASS chat backends run in process: a room subscriber receives each sent message, as a one-message delta');
"""


# Build outputs this check imports beyond the validator's own toolchain.
DISCOVERY_BUILD_OUTPUTS = (
    ROOT / "Source" / "Tools" / "ProxyGenerator" / "dist" / "analyzeSource.js",
    ROOT / "Source" / "Tools" / "ProxyGenerator" / "dist" / "renderSource.js",
    ROOT / "Source" / "Core" / "dist" / "NodeArcApplicationBuilder.js",
    ROOT / "Source" / "Chronicle" / "dist" / "ChronicleArtifacts.js",
)


def main():
    validator.ensure_toolchain()
    missing = [path.relative_to(ROOT).as_posix() for path in DISCOVERY_BUILD_OUTPUTS if not path.is_file()]
    if missing:
        raise validator.Blocked(f"packages are not built ({', '.join(missing)} missing); run `yarn build`")
    with tempfile.TemporaryDirectory(prefix="arc-vertical-slice-discovery-") as temporary:
        project = Path(temporary)
        snippets = [validator.parse(snippet_id, validator.SNIPPET_ROOT / f"{snippet_id}.md") for snippet_id in IDS]
        validator.write_project(project, snippets, validator.SNIPPETS, validator.FIXTURES)
        config = project / "tsconfig.json"
        settings = json.loads(config.read_text(encoding="utf-8"))
        settings["compilerOptions"].update({"noEmit": False, "outDir": "dist"})
        config.write_text(json.dumps(settings), encoding="utf-8")
        check = project / "check.mjs"
        folders = {validator.slug(snippet_id): "/".join(part for part in (validator.slug(snippet_id),
                   validator.SNIPPETS[snippet_id].location) if part) for snippet_id in IDS}
        modules = {validator.slug(snippet_id): sorted(stem for stem, _ in validator.module_files(
                   snippet, validator.SNIPPETS[snippet_id])) for snippet_id, snippet in zip(IDS, snippets)}
        check.write_text(CHECK.replace("__ROOT__", ROOT.as_posix()).replace("__FOLDERS__", json.dumps(folders))
                         .replace("__MODULES__", json.dumps(modules)), encoding="utf-8")
        for command in ([str(validator.TSC), "-p", str(config), "--pretty", "false"], ["node", str(check)]):
            result = subprocess.run(command, cwd=project, check=False)
            if result.returncode:
                return result.returncode
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except validator.Blocked as error:
        print(f"BLOCKED vertical-slice discovery: {error}", file=sys.stderr)
        sys.exit(validator.EXIT_BLOCKED)
    except validator.SnippetError as error:
        print(f"FAIL vertical-slice discovery: {error}", file=sys.stderr)
        sys.exit(validator.EXIT_DEFECTS)
