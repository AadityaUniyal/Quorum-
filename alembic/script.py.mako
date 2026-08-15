{% import os %}
<%block name="head">
    {{ config.get_main_option("sqlalchemy.url") }}
</%block>

<%block name="upgrades">
    {% for migration in migrations %}
        {{ migration.upgrade_sql }}
    {% endfor %}
</%block>

<%block name="downgrades">
    {% for migration in migrations %}
        {{ migration.downgrade_sql }}
    {% endfor %}
</%block>
