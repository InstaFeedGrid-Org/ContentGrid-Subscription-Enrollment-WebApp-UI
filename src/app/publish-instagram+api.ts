type PublishInstagramRequest = {
  brandName?: string;
  campaignName?: string;
  instagramUserId?: string;
  imageUrl?: string;
  caption?: string;
  accessToken?: string;
};

type InstagramCreateResponse = {
  id?: string;
  error?: InstagramError;
};

type InstagramPublishResponse = {
  id?: string;
  error?: InstagramError;
};

type InstagramError = {
  message?: string;
  type?: string;
  code?: number;
};

const graphApiVersion = 'v24.0';

export async function POST(request: Request) {
  let body: PublishInstagramRequest;
  let uploadedFile: File | null = null;

  try {
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const formData = (await request.formData()) as unknown as { get: (field: string) => unknown };
      const mediaFile = formData.get('mediaFile');
      uploadedFile = mediaFile instanceof File ? mediaFile : null;
      body = {
        instagramUserId: readFormText(formData, 'instagramUserId'),
        caption: readFormText(formData, 'caption'),
        imageUrl: readFormText(formData, 'mediaLink'),
      };
    } else {
      body = (await request.json()) as PublishInstagramRequest;
    }
  } catch {
    return Response.json({ ok: false, message: 'The publish request could not be read.' }, { status: 400 });
  }

  const imageUrl = body.imageUrl?.trim();
  const caption = body.caption?.trim();
  const instagramUserId = body.instagramUserId?.trim() || process.env.IG_USER_ID;
  const accessToken = body.accessToken?.trim() || process.env.IG_ACCESS_TOKEN;

  if (!caption) {
    return Response.json(
      {
        ok: false,
        message: 'A caption is required.',
      },
      { status: 400 },
    );
  }

  if (!imageUrl && uploadedFile) {
    return Response.json({
      ok: true,
      dryRun: true,
      message:
        'File received. To publish to Instagram, upload it through the Express backend or use Attach link with a public HTTPS media URL.',
      receivedAt: new Date().toISOString(),
      uploadedFile: { name: uploadedFile.name, type: uploadedFile.type, size: uploadedFile.size },
    });
  }

  if (!imageUrl) {
    return Response.json(
      { ok: false, message: 'Choose a file or provide a hosted media link.' },
      { status: 400 },
    );
  }

  if (!isValidHttpUrl(imageUrl)) {
    return Response.json(
      {
        ok: false,
        message: 'Image URL must be a valid public http or https URL.',
      },
      { status: 400 },
    );
  }

  if (!instagramUserId || !accessToken) {
    return Response.json({
      ok: true,
      dryRun: true,
      message:
        'Publish endpoint reached. Set IG_USER_ID and IG_ACCESS_TOKEN, or provide demo values in the form, to publish through Instagram Graph API.',
      receivedAt: new Date().toISOString(),
      preview: {
        brandName: body.brandName?.trim() || null,
        campaignName: body.campaignName?.trim() || null,
        imageUrl,
        caption,
      },
    });
  }

  try {
    const creation = await createInstagramMediaContainer({
      instagramUserId,
      accessToken,
      imageUrl,
      caption,
    });

    if (!creation.id) {
      return instagramErrorResponse(creation.error, 'Instagram did not return a media container.');
    }

    const publication = await publishInstagramMedia({
      instagramUserId,
      accessToken,
      creationId: creation.id,
    });

    if (!publication.id) {
      return instagramErrorResponse(
        publication.error,
        'Instagram did not return a published media ID.',
      );
    }

    return Response.json({
      ok: true,
      message: 'Content was published to Instagram.',
      instagramMediaId: publication.id,
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unexpected failure while publishing to Instagram.',
      },
      { status: 500 },
    );
  }
}

function readFormText(formData: { get: (field: string) => unknown }, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value : undefined;
}

async function createInstagramMediaContainer({
  instagramUserId,
  accessToken,
  imageUrl,
  caption,
}: {
  instagramUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}) {
  const response = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${instagramUserId}/media`,
    {
      method: 'POST',
      body: toFormBody({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    },
  );

  return (await response.json()) as InstagramCreateResponse;
}

async function publishInstagramMedia({
  instagramUserId,
  accessToken,
  creationId,
}: {
  instagramUserId: string;
  accessToken: string;
  creationId: string;
}) {
  const response = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${instagramUserId}/media_publish`,
    {
      method: 'POST',
      body: toFormBody({
        creation_id: creationId,
        access_token: accessToken,
      }),
    },
  );

  return (await response.json()) as InstagramPublishResponse;
}

function toFormBody(values: Record<string, string>) {
  const body = new FormData();

  for (const [key, value] of Object.entries(values)) {
    body.append(key, value);
  }

  return body;
}

function instagramErrorResponse(error: InstagramError | undefined, fallback: string) {
  return Response.json(
    {
      ok: false,
      message: error?.message || fallback,
      instagramError: error ?? null,
    },
    { status: 502 },
  );
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
