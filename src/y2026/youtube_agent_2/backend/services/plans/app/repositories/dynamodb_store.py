"""Single-table DynamoDB persistence for plans and source-sync metadata."""

from __future__ import annotations

import json
from urllib.parse import quote, unquote

def _id(value: str) -> str:
    return quote(str(value), safe="")


def _json(value: dict) -> str:
    return json.dumps(value, default=str, separators=(",", ":"))


class DynamoDBStore:
    def __init__(self, table_name: str):
        if not table_name:
            raise RuntimeError("DYNAMODB_TABLE_NAME is required for DynamoDB storage")
        import boto3
        from boto3.dynamodb.conditions import Attr, Key

        self.table = boto3.resource("dynamodb").Table(table_name)
        self._key = Key
        self._attr = Attr

    @staticmethod
    def _pk(user_id: str) -> str:
        return f"USER#{user_id}"

    def _query_prefix(self, user_id: str, prefix: str) -> list[dict]:
        response = self.table.query(
            KeyConditionExpression=self._key("PK").eq(self._pk(user_id)) & self._key("SK").begins_with(prefix)
        )
        items = list(response.get("Items", []))
        while response.get("LastEvaluatedKey"):
            response = self.table.query(
                KeyConditionExpression=self._key("PK").eq(self._pk(user_id)) & self._key("SK").begins_with(prefix),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return items

    def _replace_prefix(self, user_id: str, prefix: str, items: list[dict]) -> None:
        existing = [
            item
            for item in self._query_prefix(user_id, prefix)
            if item["SK"] == prefix or item["SK"].startswith(f"{prefix}#")
        ]
        new_items = [{"PK": self._pk(user_id), **item} for item in items]
        new_keys = {(item["PK"], item["SK"]) for item in new_items}
        with self.table.batch_writer() as batch:
            for item in new_items:
                batch.put_item(Item=item)
        stale_items = [
            item for item in existing if (item["PK"], item["SK"]) not in new_keys
        ]
        if stale_items:
            with self.table.batch_writer() as batch:
                for item in stale_items:
                    batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})

    def save_plan(self, plan: dict, user_id: str) -> None:
        plan_id = _id(plan["id"])
        prefix = f"PLAN#{plan_id}"
        header = {key: value for key, value in plan.items() if key != "courses"}
        items = [{"SK": prefix, "entity": "plan", "data": _json(header)}]
        for course in plan.get("courses", []):
            course_id = _id(course["id"])
            course_prefix = f"{prefix}#COURSE#{course_id}"
            course_data = {
                key: value
                for key, value in course.items()
                if key not in {"modules", "source_channels", "new_video_feeds"}
            }
            items.append({"SK": course_prefix, "entity": "course", "data": _json(course_data)})
            for channel in course.get("source_channels", []):
                channel_data = {key: value for key, value in channel.items() if key != "playlists"}
                channel_prefix = f"{course_prefix}#SOURCE#{_id(channel['channel_id'])}"
                items.append({"SK": channel_prefix, "entity": "course_source", "data": _json(channel_data)})
                for playlist in channel.get("playlists", []):
                    playlist_id = playlist.get("playlist_id") or playlist.get("id")
                    items.append({"SK": f"{channel_prefix}#PLAYLIST#{_id(playlist_id)}", "entity": "course_source_playlist", "data": _json(playlist)})
            for feed_index, feed in enumerate(course.get("new_video_feeds", [])):
                feed_prefix = f"{course_prefix}#FEED#{feed_index:06d}"
                feed_data = {key: value for key, value in feed.items() if key != "videos"}
                items.append({"SK": feed_prefix, "entity": "course_feed", "data": _json(feed_data)})
                for video in feed.get("videos", []):
                    items.append({"SK": f"{feed_prefix}#VIDEO#{_id(video['video_id'])}", "entity": "course_feed_video", "data": _json(video)})
            for module in course.get("modules", []):
                module_prefix = f"{course_prefix}#MODULE#{_id(module['id'])}"
                module_data = {key: value for key, value in module.items() if key != "videos"}
                items.append({"SK": module_prefix, "entity": "module", "data": _json(module_data)})
                for video in module.get("videos", []):
                    items.append({"SK": f"{module_prefix}#VIDEO#{_id(video['video_id'])}", "entity": "video", "data": _json(video)})
        self._replace_prefix(user_id, prefix, items)

    def load_plan(self, plan_id: str, user_id: str) -> dict | None:
        prefix = f"PLAN#{_id(plan_id)}"
        items = [
            item
            for item in self._query_prefix(user_id, prefix)
            if item["SK"] == prefix or item["SK"].startswith(f"{prefix}#")
        ]
        header_item = next((item for item in items if item["SK"] == prefix), None)
        if not header_item:
            return None
        plan = json.loads(header_item["data"])
        courses: dict[str, dict] = {}
        modules: dict[tuple[str, str], dict] = {}
        sources: dict[tuple[str, str], dict] = {}
        feeds: dict[tuple[str, str], dict] = {}
        for item in items:
            parts = item["SK"].split("#")
            entity = item.get("entity")
            data = json.loads(item["data"])
            if entity == "course":
                courses[unquote(parts[3])] = {**data, "modules": [], "source_channels": [], "new_video_feeds": []}
            elif entity == "module":
                key = (unquote(parts[3]), unquote(parts[5]))
                modules[key] = {**data, "videos": []}
            elif entity == "video":
                modules[(unquote(parts[3]), unquote(parts[5]))]["videos"].append(data)
            elif entity == "course_source":
                key = (unquote(parts[3]), unquote(parts[5]))
                sources[key] = {**data, "playlists": []}
            elif entity == "course_source_playlist":
                sources[(unquote(parts[3]), unquote(parts[5]))]["playlists"].append(data)
            elif entity == "course_feed":
                key = (unquote(parts[3]), parts[5])
                feeds[key] = {**data, "videos": []}
            elif entity == "course_feed_video":
                feeds[(unquote(parts[3]), parts[5])]["videos"].append(data)
        for (course_id, _), module in modules.items():
            module["videos"].sort(key=lambda video: video.get("sequence", 0))
            courses[course_id]["modules"].append(module)
        for (course_id, _), source in sources.items():
            courses[course_id]["source_channels"].append(source)
        for (course_id, _), feed in feeds.items():
            courses[course_id]["new_video_feeds"].append(feed)
        for course in courses.values():
            course["modules"].sort(key=lambda module: module.get("sequence", 0))
        plan["courses"] = sorted(courses.values(), key=lambda course: course.get("sequence", 0))
        return plan

    def delete_plan(self, plan_id: str, user_id: str) -> bool:
        prefix = f"PLAN#{_id(plan_id)}"
        items = [
            item
            for item in self._query_prefix(user_id, prefix)
            if item["SK"] == prefix or item["SK"].startswith(f"{prefix}#")
        ]
        if not any(item["SK"] == prefix for item in items):
            return False
        with self.table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
        return True

    def list_plans(self, user_id: str) -> list[dict]:
        headers = [
            json.loads(item["data"])
            for item in self._query_prefix(user_id, "PLAN#")
            if item.get("entity") == "plan"
        ]
        plans = [self.load_plan(header["id"], user_id) for header in headers]
        return sorted(
            [plan for plan in plans if plan],
            key=lambda plan: plan.get("updated_at", ""),
            reverse=True,
        )

    def save_public_plan(self, share_id: str, owner_id: str, plan_id: str, projection: dict) -> None:
        key = f"PUBLIC_PLAN#{_id(share_id)}"
        self.table.put_item(Item={
            "PK": key,
            "SK": key,
            "entity": "public_plan",
            "owner_id": owner_id,
            "plan_id": plan_id,
            "published_at": str(projection.get("published_at") or ""),
            "updated_at": str(projection.get("updated_at") or ""),
            "data": _json(projection),
        })

    def load_public_plan(self, share_id: str) -> dict | None:
        key = f"PUBLIC_PLAN#{_id(share_id)}"
        item = self.table.get_item(Key={"PK": key, "SK": key}).get("Item")
        return json.loads(item["data"]) if item and item.get("entity") == "public_plan" else None

    def list_public_plans(self, *, limit: int = 20, offset: int = 0) -> tuple[list[dict], int]:
        response = self.table.scan(
            FilterExpression=self._attr("entity").eq("public_plan"),
            ProjectionExpression="#data, plan_id",
            ExpressionAttributeNames={"#data": "data"},
        )
        items = list(response.get("Items", []))
        while response.get("LastEvaluatedKey"):
            response = self.table.scan(
                FilterExpression=self._attr("entity").eq("public_plan"),
                ProjectionExpression="#data, plan_id",
                ExpressionAttributeNames={"#data": "data"},
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        plans = [{**json.loads(item["data"]), "plan_id": item.get("plan_id")} for item in items]
        plans = sorted(
            plans,
            key=lambda plan: plan.get("published_at") or plan.get("updated_at") or "",
            reverse=True,
        )
        return plans[offset:offset + limit], len(plans)

    def delete_public_plan(self, share_id: str) -> None:
        key = f"PUBLIC_PLAN#{_id(share_id)}"
        self.table.delete_item(Key={"PK": key, "SK": key})

    def save_source_sync_metadata(self, metadata: dict, user_id: str) -> None:
        items = [{"SK": "SYNC#META", "entity": "sync", "data": _json({"updated_at": metadata.get("updated_at")})}]
        for channel in metadata.get("channels", []):
            channel_prefix = f"SYNC#CHANNEL#{_id(channel['channel_id'])}"
            channel_data = {key: value for key, value in channel.items() if key not in {"playlists", "new_videos"}}
            items.append({"SK": channel_prefix, "entity": "sync_channel", "data": _json(channel_data)})
            for video in channel.get("new_videos", []):
                items.append({"SK": f"{channel_prefix}#NEW#{_id(video['video_id'])}", "entity": "sync_channel_video", "data": _json(video)})
            for playlist in channel.get("playlists", []):
                playlist_id = playlist.get("playlist_id") or playlist.get("id")
                playlist_prefix = f"{channel_prefix}#PLAYLIST#{_id(playlist_id)}"
                playlist_data = {key: value for key, value in playlist.items() if key != "new_videos"}
                items.append({"SK": playlist_prefix, "entity": "sync_playlist", "data": _json(playlist_data)})
                for video in playlist.get("new_videos", []):
                    items.append({"SK": f"{playlist_prefix}#NEW#{_id(video['video_id'])}", "entity": "sync_playlist_video", "data": _json(video)})
        self._replace_prefix(user_id, "SYNC#", items)

    def load_source_sync_metadata(self, user_id: str) -> dict:
        items = self._query_prefix(user_id, "SYNC#")
        meta = next((json.loads(item["data"]) for item in items if item.get("entity") == "sync"), {"updated_at": None})
        channels: dict[str, dict] = {}
        playlists: dict[tuple[str, str], dict] = {}
        for item in items:
            parts = item["SK"].split("#")
            entity = item.get("entity")
            data = json.loads(item["data"])
            if entity == "sync_channel":
                channels[unquote(parts[2])] = {**data, "playlists": [], "new_videos": []}
            elif entity == "sync_channel_video":
                channels[unquote(parts[2])]["new_videos"].append(data)
            elif entity == "sync_playlist":
                key = (unquote(parts[2]), unquote(parts[4]))
                playlists[key] = {**data, "new_videos": []}
            elif entity == "sync_playlist_video":
                playlists[(unquote(parts[2]), unquote(parts[4]))]["new_videos"].append(data)
        for (channel_id, _), playlist in playlists.items():
            channels[channel_id]["playlists"].append(playlist)
        return {**meta, "channels": list(channels.values())}
