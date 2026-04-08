from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.db.database import get_db
from app.models.user import UserCreate, UserLogin, TokenResponse, UserPublic
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user
import base64

router = APIRouter()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _to_public(user: dict) -> UserPublic:
    return UserPublic(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        plan=user.get("plan", "free"),
        usage_limit=user.get("usage_limit", 50),
        usage_count=user.get("usage_count", 0),
        avatar_url=user.get("avatar_url"),
        created_at=user["created_at"],
    )


@router.post("/signup", response_model=TokenResponse)
async def signup(body: UserCreate):
    db = get_db()
    normalized_email = _normalize_email(body.email)
    existing_user = await db["users"].find_one({"email": normalized_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "name": body.name,
        "email": normalized_email,
        "hashed_password": hash_password(body.password),
        "plan": "free",
        "usage_limit": 50,
        "usage_count": 0,
        "created_at": __import__("datetime").datetime.utcnow(),
    }
    result = await db["users"].insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    token = create_access_token(str(result.inserted_id))
    return TokenResponse(access_token=token, user=_to_public(user_doc))


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin):
    db = get_db()
    normalized_email = _normalize_email(body.email)
    user = await db["users"].find_one({"email": normalized_email})
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user["_id"]))
    return TokenResponse(access_token=token, user=_to_public(user))


@router.get("/me", response_model=UserPublic)
async def me(current_user=Depends(get_current_user)):
    return _to_public(current_user)


@router.post("/avatar", response_model=UserPublic)
async def upload_avatar(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP images allowed")
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:  # 2MB limit
        raise HTTPException(status_code=400, detail="Image must be under 2MB")
    b64 = base64.b64encode(contents).decode()
    avatar_url = f"data:{file.content_type};base64,{b64}"
    db = get_db()
    await db["users"].update_one(
        {"_id": current_user["_id"]},
        {"$set": {"avatar_url": avatar_url}}
    )
    current_user["avatar_url"] = avatar_url
    return _to_public(current_user)
