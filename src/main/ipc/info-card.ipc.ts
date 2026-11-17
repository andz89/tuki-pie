import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import { LinkFilter } from '../../shared/link-rules';
import {
  InfoCardField,
  InfoCardLayout,
  InfoCardView,
  LinksOpenIn,
} from '../../shared/schemas/info-card.schema';
import {
  MAX_PAGE_LIST,
  MAX_PAGE_URL,
} from '../../shared/schemas/page-info.schema';
import { MAX_OPEN_LINKS } from '../../shared/types';
import type { SettingsService } from '../services/settings.service';
import { UserError } from '../services/user-error';
import {
  closeInfoCard,
  highlightInfoCardPage,
  infoCardImages,
  infoCardState,
  openInfoCardInWebPage,
  openInfoCardLinkHere,
  openInfoCardLinks,
  setInfoCardFields,
  setInfoCardLayout,
  setInfoCardLinkFilter,
  setInfoCardPinned,
  setInfoCardSettings,
  setInfoCardView,
  setLinksOpenIn,
  showInfoCardLink,
} from '../windows/info-card-window';
import { handle } from './handle';

// The highlight field's text, at most.
const MAX_HIGHLIGHT_TEXT = 500;

export function registerInfoCardIpc(settings: SettingsService): void {
  setInfoCardSettings(settings);

  handle(IpcChannels.infoCardGetState, z.tuple([]), () => {
    const state = infoCardState();
    if (!state) {
      throw new UserError('The Info Card is closed.');
    }
    return state;
  });

  handle(IpcChannels.infoCardSetPinned, z.tuple([z.boolean()]), (pinned) =>
    setInfoCardPinned(pinned),
  );

  handle(IpcChannels.infoCardSetLayout, z.tuple([InfoCardLayout]), (layout) =>
    setInfoCardLayout(layout),
  );

  handle(
    IpcChannels.infoCardSetFields,
    z.tuple([z.array(InfoCardField).max(10)]),
    (fields) => setInfoCardFields(fields),
  );

  // Featured images come only from Chrome, as on Web Page.
  handle(
    IpcChannels.infoCardImage,
    z.tuple([z.string().max(MAX_PAGE_URL), z.enum(['thumb', 'full'])]),
    (url, size) => infoCardImages()?.get(url, size) ?? null,
  );

  handle(IpcChannels.infoCardClose, z.tuple([]), () => closeInfoCard());

  handle(IpcChannels.infoCardOpenInWebPage, z.tuple([]), () =>
    openInfoCardInWebPage(),
  );

  handle(IpcChannels.infoCardSetView, z.tuple([InfoCardView]), (view) =>
    setInfoCardView(view),
  );

  // The Links card. Main checks each link against the card page itself.
  handle(
    IpcChannels.infoCardShowLink,
    z.tuple([
      z.number().int().min(0).max(MAX_PAGE_LIST),
      z.string().max(MAX_PAGE_URL),
    ]),
    (index, href) => showInfoCardLink(index, href),
  );

  handle(
    IpcChannels.infoCardOpenLinks,
    z.tuple([
      z.array(z.string().max(MAX_PAGE_URL)).max(MAX_OPEN_LINKS),
      z.array(z.string().max(MAX_PAGE_URL)).max(MAX_OPEN_LINKS),
    ]),
    (urls, ticked) => openInfoCardLinks(urls, ticked),
  );

  handle(
    IpcChannels.infoCardOpenHere,
    z.tuple([z.string().max(MAX_PAGE_URL), z.boolean()]),
    (href, ticked) => openInfoCardLinkHere(href, ticked),
  );

  handle(IpcChannels.infoCardSetLinkFilter, z.tuple([LinkFilter]), (filter) =>
    setInfoCardLinkFilter(filter),
  );

  handle(
    IpcChannels.infoCardHighlight,
    z.tuple([z.string().max(MAX_HIGHLIGHT_TEXT)]),
    (text) => highlightInfoCardPage(text),
  );

  handle(IpcChannels.infoCardSetLinksOpenIn, z.tuple([LinksOpenIn]), (openIn) =>
    setLinksOpenIn(openIn),
  );
}
